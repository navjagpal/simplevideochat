function Channel(id, ref) {
  this.id = id;
  this.ref = ref;
  this.onmessage = null;
  this.ref.on('child_added', function(data) {
    // The messagew was sent by this client, ignore.
    data = data.val();
    if (data.id == this.id) {
      return;
    }
    console.log(data);
    if (this.onmessage) {
      this.onmessage(data.data);
    }
  }.bind(this));
};

Channel.prototype.send = function(data) {
  this.ref.push({id: this.id, data: data}).then(function() {
    // TODO(nav): Do something?
  }.bind(this)).catch(function(error) {
    console.error('Error writing new message to Firebase Database', error);
  });
};

function VideoCall(stream, channel) {
  this.stream = stream;
  this.channel = channel;
  this.onremotestream = null;
  this.pc = new RTCPeerConnection(null);
  this.pc.onicecandidate = function (evt) {
    this.channel.send(JSON.stringify({ "candidate": evt.candidate }));
  }.bind(this);
  this.pc.onaddstream = function (evt) {
    if (this.onremotestream) {
      this.onremotestream(evt.stream);
    }
  }.bind(this);
  this.pc.addStream(this.stream);

  function gotDescription(desc) {
    this.pc.setLocalDescription(desc);
    this.channel.send(JSON.stringify({ "sdp": desc }));
  };

  this.channel.onmessage = function(evt) {
    var signal = JSON.parse(evt);
    if (signal.sdp) {
      if (signal.sdp.type == 'offer') {
        this.pc.setRemoteDescription(
          new RTCSessionDescription(signal.sdp)).then(function() {
            this.pc.createAnswer().then(function(desc) {
              this.pc.setLocalDescription(desc);
              this.channel.send(JSON.stringify({ "sdp": desc }));
            }.bind(this));
          }.bind(this));
      } else {
        this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } 
    } else if (signal.candidate) {
      this.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  }.bind(this);
};

VideoCall.prototype.call = function() {
  this.pc.createOffer().then(function(desc) {
    this.pc.setLocalDescription(desc);
    this.channel.send(JSON.stringify({ "sdp": desc }));
  }.bind(this));
};

function VideoChat(id, stream, database) {
  this.id = id;
  this.stream = stream;
  this.database = database;
  this.onremotestream = null;
  this.onremotestreamremoved = null;

  this.room = this.database.ref('room');
  this.connectedUser = this.room.child(id);
  this.connectedUser.set(id);
  this.connectedUser.onDisconnect().remove();

  this.calls = {};

  this.room.on('child_removed', function(data) {
    if (data.val() == this.id) {
      return;
    }
    if (this.calls[data.val()]) {
      if (this.onremotestreamremoved) {
        this.onremotestreamremoved(data.val());
        delete this.calls[data.val()];
      } 
    }
  }.bind(this));

  // Create channels with everyone that is in the room.
  this.room.on('child_added', function(data) {
    if (data.val() == this.id) {
      return;
    }
    var ids = [data.val(), this.id];
    ids.sort();
    var channelRef = this.database.ref('channels/' + ids[0] + '/' + ids[1]);
    var call = new VideoCall(this.stream, new Channel(this.id, channelRef));
    call.onremotestream = function(stream) {
      if (this.onremotestream) {
        this.onremotestream(data.val(), stream);
      }
    }.bind(this);
    this.calls[data.val()] = call;
    if (ids[0] == this.id) {
      call.call();
    }
  }.bind(this));
};
