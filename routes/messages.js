var express = require('express');
var router = express.Router();
let { CheckLogin } = require('../utils/authHandler');
let messageController = require('../controllers/messages');

// GET /:userID - Lấy toàn bộ lịch sử hội thoại với một user
router.get('/:userID', CheckLogin, async function (req, res, next) {
    try {
        let currentUserId = req.user._id;
        let targetUserId = req.params.userID;
        let messages = await messageController.GetConversation(currentUserId, targetUserId);
        res.send(messages);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// POST / - Gửi tin nhắn (text hoặc file)
router.post('/', CheckLogin, async function (req, res, next) {
    try {
        let sender = req.user._id;
        let { receiver, content, filePath } = req.body;

        let type = 'text';
        let messageContent = content;

        if (filePath) {
            type = 'file';
            messageContent = filePath;
        }

        let newMessage = await messageController.SendMessage(sender, receiver, messageContent, type);
        res.send(newMessage);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

// GET / - Lấy tin nhắn mới nhất của mỗi cuộc hội thoại
router.get('/', CheckLogin, async function (req, res, next) {
    try {
        let userId = req.user._id;
        let latestMessages = await messageController.GetLatestMessages(userId);
        res.send(latestMessages);
    } catch (err) {
        res.status(500).send({ message: err.message });
    }
});

module.exports = router;
