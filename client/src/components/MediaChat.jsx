import React, { useEffect, useRef, useState } from 'react';
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiMonitor, FiMaximize } from 'react-icons/fi';

const MediaChat = ({ socket, users, canSpeak }) => {
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const peersRef = useRef({}); // socketId -> { pc, videoEl }
  
  const [micEnabled, setMicEnabled] = useState(false);
  const [camEnabled, setCamEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activePeers, setActivePeers] = useState([]);
  
  const audioTrackRef = useRef(null);
  const videoTrackRef = useRef(null);

  const createDummyVideoTrack = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    canvas.getContext('2d').fillRect(0, 0, 2, 2);
    // Add framerate to captureStream to prevent WebRTC stream from stalling
    return canvas.captureStream(1).getVideoTracks()[0];
  };

  const createDummyAudioTrack = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = ctx.createMediaStreamDestination();
      return dest.stream.getAudioTracks()[0];
    } catch (err) {
      console.warn("AudioContext not supported or disabled:", err);
      return null;
    }
  };

  // Initialize pure dummy streams on mount
  useEffect(() => {
    const dummyAudio = createDummyAudioTrack();
    const dummyVideo = createDummyVideoTrack();
    const tracks = [];
    if (dummyAudio) { dummyAudio.enabled = false; tracks.push(dummyAudio); }
    if (dummyVideo) { dummyVideo.enabled = false; tracks.push(dummyVideo); }
    
    localStreamRef.current = new MediaStream(tracks);
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioTrackRef.current) audioTrackRef.current.stop();
      if (videoTrackRef.current) videoTrackRef.current.stop();
      Object.values(peersRef.current).forEach(peer => peer.pc.close());
    };
  }, []);

  // Handle Admin Mute enforcement
  useEffect(() => {
    if (!canSpeak) {
      if (micEnabled && audioTrackRef.current) {
        audioTrackRef.current.enabled = false;
        setMicEnabled(false);
      }
      if (camEnabled && videoTrackRef.current) {
        videoTrackRef.current.enabled = false;
        setCamEnabled(false);
      }
      if (isScreenSharing) {
        stopScreenShare();
      }
    }
  }, [canSpeak, micEnabled, camEnabled, isScreenSharing]);

  const replaceTrackInPeers = (track, kind) => {
    Object.values(peersRef.current).forEach(peer => {
      const sender = peer.pc.getSenders().find(s => s.track?.kind === kind);
      if (sender) {
        sender.replaceTrack(track).catch(err => console.error("Error replacing track", err));
      }
    });
  };

  const toggleMic = async () => {
    if (!canSpeak) return;
    
    if (!audioTrackRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioTrackRef.current = stream.getAudioTracks()[0];
        
        // Ensure the dummy audio track is fully replaced in the local stream
        const oldAudio = localStreamRef.current.getAudioTracks()[0];
        if (oldAudio) localStreamRef.current.removeTrack(oldAudio);
        localStreamRef.current.addTrack(audioTrackRef.current);
        
        replaceTrackInPeers(audioTrackRef.current, 'audio');
      } catch (err) {
        console.error("Audio permission denied or unavailable:", err);
        alert(`Microphone Error: ${err.name} - ${err.message}\nIf this says NotFoundError, you do not have a mic plugged in. If it says NotAllowedError, your browser/OS is blocking it permanently (check the URL bar).`);
        return;
      }
    }
    
    // Toggle state
    const newState = !micEnabled;
    audioTrackRef.current.enabled = newState;
    setMicEnabled(newState);
  };

  const toggleCamera = async () => {
    if (!canSpeak || isScreenSharing) return;
    
    if (!videoTrackRef.current) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoTrackRef.current = stream.getVideoTracks()[0];
        
        const oldVideo = localStreamRef.current.getVideoTracks()[0];
        if (oldVideo) localStreamRef.current.removeTrack(oldVideo);
        localStreamRef.current.addTrack(videoTrackRef.current);
        
        replaceTrackInPeers(videoTrackRef.current, 'video');
        
        // Re-inject to preview
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      } catch (err) {
        console.error("Camera permission denied or unavailable:", err);
        alert(`Camera Error: ${err.name} - ${err.message}\nIf this says NotFoundError, you do not have a webcam plugged in. If it says NotAllowedError, your browser/OS is permanently blocking it.`);
        return;
      }
    }
    
    const newState = !camEnabled;
    videoTrackRef.current.enabled = newState;
    setCamEnabled(newState);
  };

  const toggleScreenShare = async () => {
    if (!canSpeak) return;
    
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        replaceTrackInPeers(screenTrack, 'video');
        if (localVideoRef.current) localVideoRef.current.srcObject = screenStream;

        screenTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.error("Screen share error", err);
      }
    } else {
      stopScreenShare();
    }
  };

  const stopScreenShare = () => {
    if (localVideoRef.current?.srcObject && localVideoRef.current.srcObject !== localStreamRef.current) {
      localVideoRef.current.srcObject.getTracks().forEach(t => t.stop());
    }
    
    // Restore the explicit camera track if available, else restore the local stream (dummy/real cam mix)
    const trackToRestore = videoTrackRef.current || localStreamRef.current.getVideoTracks()[0];
    if (trackToRestore) {
      trackToRestore.enabled = camEnabled && canSpeak && videoTrackRef.current ? true : false;
      replaceTrackInPeers(trackToRestore, 'video');
    }
    
    if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
    setIsScreenSharing(false);
  };

  // Handle Socket Signaling
  useEffect(() => {
    if (!socket) return;

    const createPeer = async (targetId) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      const stream = localStreamRef.current;
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
        // Save the stream so we can assign it once the video element mounts
        if (peersRef.current[targetId]) {
          peersRef.current[targetId].stream = event.streams[0];
          if (peersRef.current[targetId].videoEl) {
            peersRef.current[targetId].videoEl.srcObject = event.streams[0];
          }
        }
      };

      peersRef.current[targetId] = { pc, videoEl: null, stream: null, iceCandidatesQueue: [] };
      setActivePeers(prev => [...prev.filter(id => id !== targetId), targetId]);
      return pc;
    };

    const handleUserJoined = async ({ users: updatedUsers }) => {
      const newUsers = updatedUsers.filter(u => u.id !== socket.id && !peersRef.current[u.id]);
      for (const u of newUsers) {
        const pc = await createPeer(u.id);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', { targetId: u.id, sdp: pc.localDescription });
      }
    };

    const processIceQueue = async (senderId, pc) => {
      const peer = peersRef.current[senderId];
      if (peer && peer.iceCandidatesQueue) {
        for (const c of peer.iceCandidatesQueue) {
          try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch (e) {}
        }
        peer.iceCandidatesQueue = [];
      }
    };

    const handleOffer = async ({ senderId, sdp }) => {
      const pc = peersRef.current[senderId]?.pc || await createPeer(senderId);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await processIceQueue(senderId, pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { targetId: senderId, sdp: pc.localDescription });
    };

    const handleAnswer = async ({ senderId, sdp }) => {
      const pc = peersRef.current[senderId]?.pc;
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await processIceQueue(senderId, pc);
      }
    };

    const handleIceCandidate = async ({ senderId, candidate }) => {
      const peer = peersRef.current[senderId];
      if (peer) {
        if (peer.pc.remoteDescription && peer.pc.remoteDescription.type) {
          try {
            await peer.pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {
            // ignore
          }
        } else {
          peer.iceCandidatesQueue = peer.iceCandidatesQueue || [];
          peer.iceCandidatesQueue.push(candidate);
        }
      }
    };

    const handleUserLeft = ({ users: updatedUsers }) => {
      const currentIds = updatedUsers.map(u => u.id);
      Object.keys(peersRef.current).forEach(peerId => {
        if (!currentIds.includes(peerId) && peerId !== socket.id) {
          peersRef.current[peerId].pc.close();
          delete peersRef.current[peerId];
        }
      });
      setActivePeers(prev => prev.filter(id => currentIds.includes(id)));
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
    <div className="media-chat-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
      
      {/* Media Controls Layout */}
      <div style={{ display: 'flex', gap: '8px', background: '#252526', padding: '8px', borderRadius: '8px', border: '1px solid #333', justifyContent: 'center' }}>
        <button 
          onClick={toggleMic}
          disabled={!canSpeak}
          style={{
            background: micEnabled ? '#4CAF50' : '#444', color: 'white', border: 'none', borderRadius: '4px', padding: '8px', flex: 1, cursor: canSpeak ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canSpeak ? 1 : 0.5
          }}
          title="Toggle Mic"
        >
          {micEnabled ? <FiMic /> : <FiMicOff />}
        </button>
        <button 
          onClick={toggleCamera}
          disabled={!canSpeak || isScreenSharing}
          style={{
            background: camEnabled && !isScreenSharing ? '#2196F3' : '#444', color: 'white', border: 'none', borderRadius: '4px', padding: '8px', flex: 1, cursor: canSpeak && !isScreenSharing ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canSpeak && !isScreenSharing ? 1 : 0.5
          }}
          title="Toggle Camera"
        >
          {camEnabled && !isScreenSharing ? <FiVideo /> : <FiVideoOff />}
        </button>
        <button 
          onClick={toggleScreenShare}
          disabled={!canSpeak}
          style={{
            background: isScreenSharing ? '#FF9800' : '#444', color: 'white', border: 'none', borderRadius: '4px', padding: '8px', flex: 1, cursor: canSpeak ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: canSpeak ? 1 : 0.5
          }}
          title="Toggle Screen Share"
        >
          <FiMonitor />
        </button>
      </div>

      {/* Video Grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center' }}>
        {/* Local Video Preview */}
        <div style={{ flex: '1 1 100px', minHeight: '80px', background: '#000', borderRadius: '8px', overflow: 'hidden', border: '2px solid #007acc', display: (camEnabled || isScreenSharing) && canSpeak ? 'block' : 'none' }}>
          <video autoPlay playsInline muted ref={localVideoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: isScreenSharing ? 'none' : 'scaleX(-1)' }} />
        </div>
        
        {/* Remote Videos */}
        {activePeers.map(peerId => {
          const u = users.find(user => user.id === peerId);
          return (
          <div key={peerId} style={{ flex: '1 1 100px', minHeight: '80px', background: '#000', borderRadius: '8px', overflow: 'hidden', border: '1px solid #444', position: 'relative' }}>
            <video 
              autoPlay 
              playsInline 
              ref={el => { 
                if (el && peersRef.current[peerId]) {
                  peersRef.current[peerId].videoEl = el;
                  if (peersRef.current[peerId].stream && el.srcObject !== peersRef.current[peerId].stream) {
                    el.srcObject = peersRef.current[peerId].stream;
                  }
                }
              }} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <button 
              onClick={(e) => {
                e.stopPropagation();
                const videoEl = peersRef.current[peerId]?.videoEl;
                if (videoEl) {
                  if (videoEl.requestFullscreen) videoEl.requestFullscreen();
                  else if (videoEl.webkitRequestFullscreen) videoEl.webkitRequestFullscreen();
                }
              }}
              style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white', padding: '4px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}
              title="Fullscreen Share"
            >
              <FiMaximize size={12} />
            </button>
            <div style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', pointerEvents: 'none', textShadow: '1px 1px 2px black', zIndex: 10 }}>
              {u ? u.username : 'Unknown User'}
            </div>
          </div>
        )})}
      </div>
    </div>
  );
};

export default MediaChat;
