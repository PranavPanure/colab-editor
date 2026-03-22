import React, { useEffect, useRef, useState } from 'react';

const VoiceChat = ({ socket, users, canSpeak }) => {
  const localStreamRef = useRef(null);
  const streamPromiseRef = useRef(null);
  const peersRef = useRef({}); // socketId -> RTCPeerConnection
  const audioRefs = useRef({}); // socketId -> Audio element
  const [micEnabled, setMicEnabled] = useState(false);

  const getStream = () => {
    if (streamPromiseRef.current) return streamPromiseRef.current;
    streamPromiseRef.current = navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        localStreamRef.current = stream;
        stream.getAudioTracks().forEach(track => {
          track.enabled = false; // Muted by default until explicitly enabled
        });
        return stream;
      })
      .catch(err => {
        console.error("Error accessing microphone:", err);
        return null;
      });
    return streamPromiseRef.current;
  };

  // Initialize local media
  useEffect(() => {
    getStream();
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      Object.values(peersRef.current).forEach(pc => pc.close());
    };
  }, []);

  // Sync mic state with props and toggle
  useEffect(() => {
    // If stream is available, directly toggle track state
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = micEnabled && canSpeak;
      });
    }
  }, [micEnabled, canSpeak]);

  // Handle Socket Signaling
  useEffect(() => {
    if (!socket) return;

    const createPeer = async (targetId) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      const stream = await getStream(); // Wait strictly for the mic access before binding
      if (stream) {
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc-ice-candidate', { targetId, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        let audioEl = audioRefs.current[targetId];
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          audioRefs.current[targetId] = audioEl;
          document.body.appendChild(audioEl);
        }
        audioEl.srcObject = event.streams[0];
      };

      peersRef.current[targetId] = pc;
      return pc;
    };

    const handleUserJoined = async ({ username, users: updatedUsers, adminId }) => {
      const newUsers = updatedUsers.filter(u => u.id !== socket.id && !peersRef.current[u.id]);
      
      for (const u of newUsers) {
        const pc = await createPeer(u.id);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', { targetId: u.id, sdp: pc.localDescription });
      }
    };

    const handleOffer = async ({ senderId, sdp }) => {
      const pc = peersRef.current[senderId] || await createPeer(senderId);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { targetId: senderId, sdp: pc.localDescription });
    };

    const handleAnswer = async ({ senderId, sdp }) => {
      const pc = peersRef.current[senderId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    };

    const handleIceCandidate = async ({ senderId, candidate }) => {
      const pc = peersRef.current[senderId];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate', err);
        }
      }
    };

    const handleUserLeft = ({ users: updatedUsers }) => {
      const currentIds = updatedUsers.map(u => u.id);
      Object.keys(peersRef.current).forEach(peerId => {
        if (!currentIds.includes(peerId) && peerId !== socket.id) {
          peersRef.current[peerId].close();
          delete peersRef.current[peerId];
          const audioEl = audioRefs.current[peerId];
          if (audioEl) {
            audioEl.srcObject = null;
            audioEl.remove();
            delete audioRefs.current[peerId];
          }
        }
      });
    };

    socket.on('user-joined', handleUserJoined);
    socket.on('webrtc-offer', handleOffer);
    socket.on('webrtc-answer', handleAnswer);
    socket.on('webrtc-ice-candidate', handleIceCandidate);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('user-joined', handleUserJoined);
      socket.off('webrtc-offer', handleOffer);
      socket.off('webrtc-answer', handleAnswer);
      socket.off('webrtc-ice-candidate', handleIceCandidate);
      socket.off('user-left', handleUserLeft);
    };
  }, [socket]);

  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000, display: 'flex', gap: '8px', alignItems: 'center', background: '#252526', padding: '8px 16px', borderRadius: '20px', border: '1px solid #333', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
      <span style={{ color: '#ccc', fontSize: '12px', marginRight: '8px', fontFamily: 'sans-serif' }}>🎙️ Voice</span>
      <button 
        onClick={() => setMicEnabled(!micEnabled)}
        disabled={!canSpeak}
        style={{
          background: micEnabled ? '#4CAF50' : '#f44336',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          cursor: canSpeak ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: canSpeak ? 1 : 0.5,
          fontWeight: 'bold',
          fontSize: '11px',
          transition: 'all 0.2s ease-in-out'
        }}
      >
        {micEnabled ? 'ON' : 'OFF'}
      </button>
      {!canSpeak && <span style={{ fontSize: '10px', color: '#ff4d4f' }}>(Muted)</span>}
    </div>
  );
};

export default VoiceChat;
