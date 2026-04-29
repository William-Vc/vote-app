const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 12345;

// 内存数据存储（简化版，重启后数据会丢失）
let votes = [];
let userVotes = [];
let voteIdCounter = 1;

// 路由处理
const routes = {
    '/': (req, res) => {
        serveFile(res, 'vote.html', 'text/html');
    },
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
        } else if (req.method === 'DELETE') {
            votes = votes.filter(v => v.id !== id);
            userVotes = userVotes.filter(uv => uv.vote_id !== id);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: '投票已删除' }));
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
                
                // 检查是否已投票
                const existingVote = userVotes.find(uv => uv.vote_id === id && uv.user_id === userId);
                if (existingVote) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '您已投过票' }));
                    return;
                }
                
                // 更新选项票数
                const option = vote.options.find(o => o.id === optionId);
                if (!option) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '选项不存在' }));
                    return;
                }
                
                option.count++;
                
                // 记录用户投票
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

// 静态文件服务
function serveFile(res, filename, contentType) {
    const filePath = path.join(__dirname, filename);
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
            return;
        }
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

// 创建服务器
const server = http.createServer((req, res) => {
    // 设置 CORS 头部
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 处理 OPTIONS 请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    const url = req.url.split('?')[0];
    
    // 查找路由
    let matched = false;
    for (const [route, handler] of Object.entries(routes)) {
        const regex = new RegExp('^' + route.replace(':id', '(\\d+)') + '$');
        const match = url.match(regex);
        
        if (match) {
            handler(req, res, match);
            matched = true;
            break;
        }
    }
    
    if (!matched) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
    }
});

// 启动服务器
server.listen(port, '127.0.0.1', () => {
    console.log(`服务器运行在 http://localhost:${port}`);
    console.log('按 Ctrl+C 停止服务器');
});