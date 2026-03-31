var express = require("express");
var router = express.Router();
let { CheckLogin } = require("../utils/authHandler");
let messageModel = require("../schemas/messages");
let { uploadAny } = require("../utils/uploadHandler");

// ----------------------------------------------------------------
// GET /
// Lấy tin nhắn CUỐI CÙNG của mỗi cuộc trò chuyện mà user hiện tại
// đã gửi HOẶC đã nhận (danh sách hội thoại kiểu inbox)
// ----------------------------------------------------------------
router.get("/", CheckLogin, async function (req, res, next) {
  try {
    const me = req.user._id;

    // Dùng aggregate để lấy tin nhắn cuối của mỗi "cặp hội thoại"
    const lastMessages = await messageModel.aggregate([
      // 1. Lọc tất cả tin nhắn liên quan đến user hiện tại
      {
        $match: {
          $or: [{ from: me }, { to: me }],
        },
      },
      // 2. Sắp xếp mới nhất lên trước
      { $sort: { createdAt: -1 } },
      // 3. Tạo trường "partner" = ID của người kia trong cuộc trò chuyện
      {
        $addFields: {
          partner: {
            $cond: {
              if: { $eq: ["$from", me] },
              then: "$to",
              else: "$from",
            },
          },
        },
      },
      // 4. Nhóm theo partner, lấy tin nhắn đầu tiên (mới nhất do đã sort)
      {
        $group: {
          _id: "$partner",
          lastMessage: { $first: "$$ROOT" },
        },
      },
      // 5. Thay thế root bằng tin nhắn cuối
      { $replaceRoot: { newRoot: "$lastMessage" } },
      // 6. Lookup thông tin from
      {
        $lookup: {
          from: "users",
          localField: "from",
          foreignField: "_id",
          as: "from",
          pipeline: [{ $project: { username: 1, email: 1, avatarUrl: 1 } }],
        },
      },
      { $unwind: "$from" },
      // 7. Lookup thông tin to
      {
        $lookup: {
          from: "users",
          localField: "to",
          foreignField: "_id",
          as: "to",
          pipeline: [{ $project: { username: 1, email: 1, avatarUrl: 1 } }],
        },
      },
      { $unwind: "$to" },
      // 8. Sắp xếp kết quả theo thời gian mới nhất
      { $sort: { createdAt: -1 } },
    ]);

    res.send(lastMessages);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

// ----------------------------------------------------------------
// POST /
// Gửi tin nhắn đến một user khác
// Body (multipart/form-data):
//   - to   : ObjectId của người nhận (bắt buộc)
//   - text : nội dung văn bản (bắt buộc nếu KHÔNG gửi file)
//   - file : file đính kèm (tuỳ chọn)
// Nếu có file  -> { type: "file", text: <đường dẫn file> }
// Nếu chỉ text -> { type: "text", text: <nội dung> }
// ----------------------------------------------------------------
router.post(
  "/",
  CheckLogin,
  uploadAny.single("file"),
  async function (req, res, next) {
    try {
      const me = req.user._id;
      const { to, text } = req.body;

      if (!to) {
        return res
          .status(400)
          .send({ message: "Thiếu trường 'to' (userID người nhận)" });
      }

      let messageContent;

      if (req.file) {
        // Có file đính kèm -> type = "file", text = đường dẫn file
        messageContent = {
          type: "file",
          text: req.file.path,
        };
      } else {
        // Chỉ có văn bản -> type = "text"
        if (!text || text.trim() === "") {
          return res.status(400).send({
            message:
              "Nội dung tin nhắn (text) không được rỗng khi không gửi file",
          });
        }
        messageContent = {
          type: "text",
          text: text.trim(),
        };
      }

      const newMessage = new messageModel({
        from: me,
        to: to,
        messageContent: messageContent,
      });

      await newMessage.save();
      await newMessage.populate("from", "username email avatarUrl");
      await newMessage.populate("to", "username email avatarUrl");

      res.status(201).send(newMessage);
    } catch (err) {
      res.status(500).send({ message: err.message });
    }
  }
);

// ----------------------------------------------------------------
// GET /:userID
// Lấy TOÀN BỘ tin nhắn giữa user hiện tại và userID
// Bao gồm: (from: me, to: userID) và (from: userID, to: me)
// Sắp xếp theo thời gian tăng dần (cũ -> mới)
// ----------------------------------------------------------------
router.get("/:userID", CheckLogin, async function (req, res, next) {
  try {
    const me = req.user._id;
    const other = req.params.userID;

    const messages = await messageModel
      .find({
        $or: [
          { from: me, to: other },
          { from: other, to: me },
        ],
      })
      .populate("from", "username email avatarUrl")
      .populate("to", "username email avatarUrl")
      .sort({ createdAt: 1 });

    res.send(messages);
  } catch (err) {
    res.status(500).send({ message: err.message });
  }
});

module.exports = router;
