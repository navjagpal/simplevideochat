# simplevideochat
Library to make WebRTC video calls with multiple peers using Firebase real-time database for signaling.

# Library
You probably want to look at lib/simplevideochat.js for the core of the magic. If you just want to make WebRTC
video calls, that's the only part of the code you need. 

# Firebase
WebRTC doesn't define a signaling mechanism. You need signaling to exchange some information with your
peer(s) before you can establish a call. This information can be shared through any communication
channel, probably even carrier pigeon. I wanted to find the fastest way to get a simple video
client going that you could actually deploy to real users. 

It's super easy to setup a new Firebase app. You need to provide a firebase database object to the
VideoChat object, and that's it! It creates a signaling mechanism over Firebase under the hood.
Although I built this with Firebase in mind, it should be easy to swap out Firebase for something else
by just implementing the sample channel API and using your own channel when creating new VideoChat
objects. 

# Demo Web App
I've included a web app built using Polymer. You can check out the live demo here: https://simplevideochatdemo.firebaseapp.com/

You will end up in a random room, and it's unlikely there will be anyone else in the same room. That's because
the room IDs for the demo app are long randomly generated strings. Just copy the URL and share with
a friend over IM or email, or open in a new tab on the same machine. You can also just replace
the GET parameter to something easier to remember or share, but you run the risk of getting in the same
room as a stranger.
