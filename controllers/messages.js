let messageModel = require('../schemas/messages');

module.exports = {
    // Lấy toàn bộ lịch sử hội thoại giữa 2 user
    GetConversation: async function (userA, userB) {
        return await messageModel.find({
            isDeleted: false,
            $or: [
                { sender: userA, receiver: userB },
                { sender: userB, receiver: userA }
            ]
        })
            .populate('sender', 'username avatarUrl')
            .populate('receiver', 'username avatarUrl')
            .sort({ createdAt: 1 });
    },

    // Gửi tin nhắn
    SendMessage: async function (sender, receiver, content, type) {
        let newMessage = new messageModel({
            sender,
            receiver,
            content,
            type: type || 'text'
        });
        await newMessage.save();
        return newMessage;
    },

    // Lấy tin nhắn mới nhất của mỗi cuộc hội thoại
    GetLatestMessages: async function (userId) {
        let messages = await messageModel.find({
            isDeleted: false,
            $or: [
                { sender: userId },
                { receiver: userId }
            ]
        })
            .populate('sender', 'username avatarUrl')
            .populate('receiver', 'username avatarUrl')
            .sort({ createdAt: -1 });

        // Lọc tin nhắn mới nhất theo từng cuộc hội thoại (unique partner)
        let seen = new Set();
        let result = [];
        for (let msg of messages) {
            let partnerId = msg.sender._id.toString() === userId.toString()
                ? msg.receiver._id.toString()
                : msg.sender._id.toString();
            if (!seen.has(partnerId)) {
                seen.add(partnerId);
                result.push(msg);
            }
        }
        return result;
    }
};
