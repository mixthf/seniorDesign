// server.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const AWS = require('aws-sdk');

const app = express();
app.use(cors()); // Enable CORS for all routes
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: 'http://localhost:5173', // Or replace with your client's origin
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Configure AWS
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'ASIATQELDSQMNQRYEC4L',
  secretAccessKey: '9Ir7PgZg8sZG+OATtzhjAJge5M+Zv3r9Z9wqXTa7'
});

// Create a new Rekognition object
const rekognition = new AWS.Rekognition();
const users = {};

io.on('connection', (socket) => {
  users[socket.id] = socket;

  if (Object.keys(users).length === 2) {
    const [userAId, userBId] = Object.keys(users);
    users[userAId].emit('other-user', userBId);
  }

  socket.on('offer', (offer, targetSocketId) => {
    socket.to(targetSocketId).emit('offer', offer, socket.id);
  });

  socket.on('answer', (answer, targetSocketId) => {
    socket.to(targetSocketId).emit('answer', answer);
  });

  socket.on('ice-candidate', (candidate, targetSocketId) => {
    socket.to(targetSocketId).emit('ice-candidate', candidate);
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
  });

  socket.on('video-frame', (frame) => {
    // The frame should be a Buffer containing a JPEG image

    // Call Rekognition to analyze the frame
    rekognition.detectLabels({
      Image: {
        Bytes: frame
      }
    }, (err, data) => {
      if (err) {
        console.error(err);
        return;
      }

      // Send the labels back to the client
      socket.emit('labels', data.Labels);
    });
  });
});

server.listen(3000, () => {
  console.log('server listening on port 3000');
});
