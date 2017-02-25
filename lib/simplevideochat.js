/**
 * @fileoverview WebRTC video chat using Firebase for signaling.
 */

/**
 * Communications channel using Firebase realtime db.
 * @param {string} id Unique identifer representing the current session.
 * @param {Object} ref Firebase database reference which backs this channel.
*/
function FirebaseChannel(id, ref) {
  this._id = id;
  this._ref = ref;
  this.onmessage = null;
  this._ref.on('child_added', function(data) {
    // The message was sent by this client, ignore.
    data = data.val();
    if (data.id == this._id) {
      return;
    }
    if (this.onmessage) {
      this.onmessage(data.data);
    }
  }.bind(this));
};

/**
 * Sends data over the channel.
 * @param {Object} data Data to send.
 */
FirebaseChannel.prototype.send = function(data) {
  this._ref.push({id: this._id, data: data}).then(function() {
  }.bind(this)).catch(function(error) {
    console.error('Error writing new message to Firebase Database', error);
  });
};

/**
 * Represents a single call between two peers.
 * @param {Object} stream Local video stream, often retrieved from getUserMedia.
 * @param {Object} channel Communications channel between two peers.
 */
function VideoCall(stream, channel) {
  this._stream = stream;
  this._channel = channel;
  this.onRemoteStreamAdded = null;
  this._pc = new RTCPeerConnection({
    'iceServers': [
      {
        'url': 'stun:stun.l.google.com:19302',
      },
      {
        'url': 'turn:numb.viagenie.ca',
        'credential': '1e5q0zdEPiz1',
        'username': 'nav@gmail.com'
      }
    ]
  });
  this._pc.onicecandidate = function (evt) {
    this._channel.send(JSON.stringify({ "candidate": evt.candidate }));
  }.bind(this);
  this._pc.onaddstream = function (evt) {
    if (this.onRemoteStreamAdded) {
      this.onRemoteStreamAdded(evt.stream);
    }
  }.bind(this);
  this._pc.addStream(this._stream);

  this._channel.onmessage = function(evt) {
    var signal = JSON.parse(evt);
    if (signal.sdp) {
      if (signal.sdp.type == 'offer') {
        this._pc.setRemoteDescription(
          new RTCSessionDescription(signal.sdp)).then(function() {
            this._pc.createAnswer().then(function(desc) {
              this._pc.setLocalDescription(desc);
              this._channel.send(JSON.stringify({ "sdp": desc }));
            }.bind(this));
          }.bind(this));
      } else {
        this._pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } 
    } else if (signal.candidate) {
      this._pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  }.bind(this);
};

/**
 * Creates an offer to the remote peer.
 * One of the peers must call (offer) and the other needs to accept (answer).
 */
VideoCall.prototype.call = function() {
  this._pc.createOffer().then(function(desc) {
    this._pc.setLocalDescription(desc);
    this._channel.send(JSON.stringify({ "sdp": desc }));
  }.bind(this));
};

/**
 * Manages one or more p2p video calls.
 * 
 * Each video chat happens in the context of a room. All peers in a room will
 * be connected to each other. If you want everyone to be in the same room,
 * or you don't have the concept of a room, then just use the same room
 * identifier for all clients.
 *
 *
 * @param {string} id Unique identifer representing the current session.
 * @param {string} roomId Identifier for the room.
 * @param {Object} stream Local video stream, often retrieved from getUserMedia.
 * @param {Object} database Firebase database object.
 */
function VideoChatManager(id, roomId, stream, database) {
  this._id = id;
  this._roomId = roomId;
  this._stream = stream;
  this._database = database;
  
  /**
   * These events are called when a remote stream is added or removed. You need
   * to specify these callbacks if you want to be able to add remote streams
   * to your DOM.
   */
  this.onRemoteStreamAdded = null;
  this.onRemoteStreamRemoved = null;

  this._room = this._database.ref('room/' + roomId);
  this._connectedUser = this._room.child(id);
  this._connectedUser.set(id);
  this._connectedUser.onDisconnect().remove();

  this._calls = {};

  // Remove calls for disconnected peers.
  this._room.on('child_removed', function(data) {
    if (data.val() == this._id) {
      return;
    }
    if (this._calls[data.val()]) {
      if (this.onRemoteStreamRemoved) {
        this.onRemoteStreamRemoved(data.val());
        delete this._calls[data.val()];
      } 
    }
  }.bind(this));

  // Create channels with everyone that is in the room.
  this._room.on('child_added', function(data) {
    if (data.val() == this._id) {
      return;
    }
    var ids = [data.val(), this._id];
    ids.sort();
    var channelRef = this._database.ref('channels/' + this._roomId +
      '/' + ids[0] + '/' + ids[1]);
    var call = new VideoCall(this._stream, new FirebaseChannel(this._id, channelRef));
    call.onRemoteStreamAdded = function(stream) {
      if (this.onRemoteStreamAdded) {
        this.onRemoteStreamAdded(data.val(), stream);
      }
    }.bind(this);
    this._calls[data.val()] = call;

    // One of the peers needs to call the other. We need a way for both peers to
    // make different decisions (one calls, the other answers). This is done by
    // sorting ids of both peers and using the first sorted element as the
    // caller.
    if (ids[0] == this._id) {
      call.call();
    }
  }.bind(this));
};
