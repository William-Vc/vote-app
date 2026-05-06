let votes = [];
let userVotes = [];
let voteIdCounter = 1;

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { method, url, body } = req;
    const path = url.split('?')[0];

    if (path === '/api/votes') {
        if (method === 'GET') {
            res.status(200).json(votes);
        } else if (method === 'POST') {
            const { title, options } = body;
            if (!title || !options || options.length < 2) {
                res.status(400).json({ error: '投票标题和至少2个选项是必需的' });
                return;
            }
            const vote = {
                id: voteIdCounter++,
                title,
                options: options.map((name, index) => ({
                    id: index + 1,
                    name,
                    count: 0
                })),
                created_at: new Date().toISOString()
            };
            votes.push(vote);
            res.status(200).json(vote);
        } else if (method === 'DELETE') {
            votes = [];
            userVotes = [];
            voteIdCounter = 1;
            res.status(200).json({ success: true, message: '所有投票已重置' });
        }
    } else if (path.match(/^\/api\/votes\/(\d+)$/)) {
        const match = path.match(/^\/api\/votes\/(\d+)$/);
        const id = parseInt(match[1]);
        const vote = votes.find(v => v.id === id);
        if (!vote) {
            res.status(404).json({ error: '投票不存在' });
            return;
        }
        if (method === 'GET') {
            res.status(200).json(vote);
        }
    } else if (path.match(/^\/api\/votes\/(\d+)\/vote$/)) {
        const match = path.match(/^\/api\/votes\/(\d+)\/vote$/);
        const id = parseInt(match[1]);
        const vote = votes.find(v => v.id === id);
        if (!vote) {
            res.status(404).json({ error: '投票不存在' });
            return;
        }
        const { optionId, userId } = body;
        if (!optionId || !userId) {
            res.status(400).json({ error: '选项ID和用户ID是必需的' });
            return;
        }
        const existingVote = userVotes.find(uv => uv.vote_id === id && uv.user_id === userId);
        if (existingVote) {
            res.status(403).json({ error: '您已投过票' });
            return;
        }
        const option = vote.options.find(o => o.id === optionId);
        if (!option) {
            res.status(404).json({ error: '选项不存在' });
            return;
        }
        option.count++;
        userVotes.push({ vote_id: id, user_id: userId, option_id: optionId, voted_at: new Date().toISOString() });
        res.status(200).json({ success: true, message: '投票成功', vote });
    } else if (path.match(/^\/api\/votes\/(\d+)\/checkvote$/)) {
        const match = path.match(/^\/api\/votes\/(\d+)\/checkvote$/);
        const id = parseInt(match[1]);
        const userId = req.query.userId;
        if (!userId) {
            res.status(400).json({ error: '用户ID是必需的' });
            return;
        }
        const userVote = userVotes.find(uv => uv.vote_id === id && uv.user_id === userId);
        res.status(200).json({ hasVoted: !!userVote, votedOptionId: userVote ? userVote.option_id : null });
    } else {
        res.status(404).json({ error: 'Not found' });
    }
};