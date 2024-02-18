<template>
  <main class="video">
    <video ref="localVideo" autoplay playsinline muted class="mirrored"></video>
    <video ref="remoteVideo" autoplay playsinline></video>
    <button @click="startCall">Start Call</button>
    <button @click="startAnalysis">Start Analysis</button>
  </main>
</template>

<script lang="ts">
import { ref, onMounted } from 'vue';
import io from 'socket.io-client';

export default {
  name: 'VideoView',
  setup() {
    const socket = io('http://localhost:3000');
    const localConnection = new RTCPeerConnection();
    const localVideo = ref(null);
    const remoteVideo = ref(null);
    let otherUserId = null;

    // Add a canvas for capturing video frames
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    onMounted(async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.value.srcObject = stream;
      stream.getTracks().forEach(track => localConnection.addTrack(track, stream));
    });

    localConnection.onicecandidate = event => {
      if (event.candidate && otherUserId) {
        socket.emit('ice-candidate', event.candidate, otherUserId);
      }
    };

    localConnection.ontrack = event => {
      remoteVideo.value.srcObject = event.streams[0];
    };

    socket.on('other-user', userId => {
      otherUserId = userId;
      startCall();
    });

    socket.on('offer', async (offer, fromSocketId) => {
      otherUserId = fromSocketId;
      const remoteOffer = new RTCSessionDescription(offer);
      await localConnection.setRemoteDescription(remoteOffer);
      const answer = await localConnection.createAnswer();
      await localConnection.setLocalDescription(answer);
      socket.emit('answer', answer, fromSocketId);
    });

    socket.on('answer', async answer => {
      const remoteAnswer = new RTCSessionDescription(answer);
      await localConnection.setRemoteDescription(remoteAnswer);
    });

    socket.on('ice-candidate', candidate => {
      localConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    const startCall = async () => {
      if (otherUserId) {
        const offer = await localConnection.createOffer();
        await localConnection.setLocalDescription(offer);
        socket.emit('offer', offer, otherUserId);
      }
    };

    const startAnalysis = () => {
      // Call the sendFrame function on the next animation frame
      requestAnimationFrame(sendFrame);
    };

    const sendFrame = () => {
      // Draw the current video frame onto the canvas
      context.drawImage(localVideo.value, 0, 0, canvas.width, canvas.height);

      // Convert the canvas image to JPEG
      canvas.toBlob((blob) => {
        // Create a reader to convert the blob to a Buffer
        const reader = new FileReader();
        reader.onloadend = () => {
          // Send the Buffer to the server
          socket.emit('video-frame', Buffer.from(reader.result));
        };
        reader.readAsArrayBuffer(blob);
      }, 'image/jpeg');

      // Call the sendFrame function again on the next animation frame
      requestAnimationFrame(sendFrame);
    };

    return {
      localVideo,
      remoteVideo,
      startCall,
      startAnalysis  
    };
  }
};
</script>

<style scoped>
.mirrored {
  transform: scaleX(-1);
}
.video {
  padding: 1rem;
}
</style>
