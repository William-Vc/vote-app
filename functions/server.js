const http = require('http');
const fs = require('fs');
const path = require('path');

let votes = [];
let userVotes = [];
let voteIdCounter = 1;

const routes = {
    '/api/votes': (req, res) => {
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(votes));
        } else if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    const { title, options } = data;
                    
                    if (!title || !options || options.length < 2) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: '投票标题和至少2个选项是必需的' }));
                        return;
                    }
                    
                    const vote = {
                        id: voteIdCounter++,
                        title: title,
                        options: options.map((name, index) => ({
                            id: index + 1,
                            name: name,
                            count: 0
                        })),
                        created_at: new Date().toISOString()
                    };
                    
                    votes.push(vote);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(vote));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid JSON' }));
                }
            });
        } else if (req.method === 'DELETE') {
            votes = [];
            userVotes = [];
            voteIdCounter = 1;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: '所有投票已重置' }));
        }
    },
    '/api/votes/:id': (req, res, match) => {
        const id = parseInt(match[1]);
        const vote = votes.find(v => v.id === id);
        
        if (!vote) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '投票不存在' }));
            return;
        }
        
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(vote));
        }
    },
    '/api/votes/:id/vote': (req, res, match) => {
        const id = parseInt(match[1]);
        const vote = votes.find(v => v.id === id);
        
        if (!vote) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '投票不存在' }));
            return;
        }
        
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { optionId, userId } = data;
                
                if (!optionId || !userId) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '选项ID和用户ID是必需的' }));
                    return;
                }
                
                const existingVote = userVotes.find(uv => uv.vote_id === id && uv.user_id === userId);
                if (existingVote) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '您已投过票' }));
                    return;
                }
                
                const option = vote.options.find(o => o.id === optionId);
                if (!option) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '选项不存在' }));
                    return;
                }
                
                option.count++;
                
                userVotes.push({
                    vote_id: id,
                    user_id: userId,
                    option_id: optionId,
                    voted_at: new Date().toISOString()
                });
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: '投票成功', vote: vote }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    },
    '/api/votes/:id/checkvote': (req, res, match) => {
        const id = parseInt(match[1]);
        const urlParams = new URLSearchParams('?' + req.url.split('?')[1]);
        const userId = urlParams.get('userId');
        
        if (!userId) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: '用户ID是必需的' }));
            return;
        }
        
        const userVote = userVotes.find(uv => uv.vote_id === id && uv.user_id === userId);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            hasVoted: !!userVote,
            votedOptionId: userVote ? userVote.option_id : null
        }));
    }
};

exports.handler = async (event, context) => {
    const { httpMethod, path, body, queryStringParameters } = event;
    
    // 设置 CORS 头部
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    };
    
    // 处理 OPTIONS 请求
    if (httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: headers
        };
    }
    
    // 查找路由
    for (const [route, handler] of Object.entries(routes)) {
        const regex = new RegExp('^' + route.replace(':id', '(\\d+)') + '$');
        const match = path.match(regex);
        
        if (match) {
            return new Promise((resolve) => {
                const req = {
                    method: httpMethod,
                    url: path + (queryStringParameters ? '?' + new URLSearchParams(queryStringParameters).toString() : ''),
                    on: (event, callback) => {
                        if (event === 'data') callback(body || '');
                        if (event === 'end') callback();
                    }
                };
                
                const res = {
                    writeHead: (status, resHeaders) => {
                        headers['Content-Type'] = resHeaders['Content-Type'];
                    },
                    end: (data) => {
                        resolve({
                            statusCode: 200,
                            headers: headers,
                            body: data
                        });
                    }
                };
                
                handler(req, res, match);
            });
        }
    }
    
    return {
        statusCode: 404,
        headers: headers,
        body: JSON.stringify({ error: 'Not found' })
    };
};