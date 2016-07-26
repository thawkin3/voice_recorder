// audio variables
var leftchannel = [];
var rightchannel = [];
var recorder = null;
var recording = false;
var recordingLength = 0;
var volume = null;
var audioInput = null;
var sampleRate = null;
var audioContext = null;
var context = null;
var outputElement;
var outputString;
var rate = 16000;    // DOWNSAMPLE TO 16kHz
var fileName = "recording.wav";

// feature detection 
if (!navigator.getUserMedia)
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
                  navigator.mozGetUserMedia || navigator.mediaDevices.getUserMedia || navigator.msGetUserMedia;

if (navigator.getUserMedia){
    navigator.getUserMedia({audio:true}, success, function(e) {
        alert('Error capturing audio.');
    });
} else alert('getUserMedia not supported in this browser.');

// navigator.getUserMedia({
//     "audio": {
//         "mandatory": {
//             "googEchoCancellation": "false",
//             "googAutoGainControl": "false",
//             "googNoiseSuppression": "false",
//             "googHighpassFilter": "false"
//         },
//         "optional": []
//     },
// });

$(document).ready(function(){
    outputElement = document.getElementById('output');

    $("#mic").click(function(){
        toggleRecording($(this));
    });
});

function toggleRecording(yourButton) {
    if (yourButton.hasClass("recording")) {
        // stop recording
        recording = false;
        
        outputElement.innerHTML = 'Building wav file...';

        // we flat the left and right channels down
        var leftBuffer = mergeBuffers ( leftchannel, recordingLength );
        var rightBuffer = mergeBuffers ( rightchannel, recordingLength );
        // we interleave both channels together
        var interleaved = interleave ( leftBuffer, rightBuffer ); // ORIGINAL
        
        // we create our wav file
        var buffer;
        if (sampleRate <= 32000) {
            buffer = new ArrayBuffer(44 + interleaved.length * 2); // ORIGINAL
        } else {
            buffer = new ArrayBuffer(44 + leftBuffer.length * 2); // CUT SAMPLE RATE IN HALF
        }
        var view = new DataView(buffer);
        
        // RIFF chunk descriptor
        writeUTFBytes(view, 0, 'RIFF');
        if (sampleRate <= 32000) {
            view.setUint32(4, 44 + interleaved.length * 2, true); // ORIGINAL
        } else {
            view.setUint32(4, 44 + leftBuffer.length * 2, true); // CUT SAMPLE RATE IN HALF
        }
        writeUTFBytes(view, 8, 'WAVE');
        
        // FMT sub-chunk
        writeUTFBytes(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        
        // stereo (2 channels)
        view.setUint16(22, 2, true);
        if (sampleRate <= 32000) {
            view.setUint32(24, sampleRate, true); // ORIGINAL
        } else {
            view.setUint32(24, (sampleRate/2), true); // CUT SAMPLE RATE IN HALF
        }
        if (sampleRate <= 32000) {
            view.setUint32(28, sampleRate * 4, true); // ORIGINAL
        } else {
            view.setUint32(28, (sampleRate/2) * 4, true); // CUT SAMPLE RATE IN HALF
        }
        view.setUint16(32, 4, true);
        view.setUint16(34, 16, true);
        
        // data sub-chunk
        writeUTFBytes(view, 36, 'data');
        if (sampleRate <= 32000) {
            view.setUint32(40, interleaved.length * 2, true); // ORIGINAL
        } else {
            view.setUint32(40, leftBuffer.length * 2, true); // CUT SAMPLE RATE IN HALF
        }
        
        // write the PCM samples
        var lng;
        if (sampleRate <= 32000) {
            lng = interleaved.length; // ORIGINAL
        } else {
            lng = leftBuffer.length; // CUT SAMPLE RATE IN HALF
        }
        var index = 44;
        var volume = 1;
        for (var i = 0; i < lng; i++){
            if (sampleRate <= 32000) {
                view.setInt16(index, interleaved[i] * (0x7FFF * volume), true); // ORIGINAL
            } else {
                view.setInt16(index, leftBuffer[i] * (0x7FFF * volume), true); // CUT SAMPLE RATE IN HALF
            }
            index += 2;
        }
        
        // our final binary blob
        var blob = new Blob ( [ view ], { type : 'audio/wav' } );
        console.log(blob);

        // UPDATE THIS PART TO UPLOAD TO FILE UPLOAD QUESTION INSTEAD OF SAVING LOCALLY
        outputElement.innerHTML = 'Handing off the file now...';
        uploadToSurvey(blob);

        // let's save it locally
        // outputElement.innerHTML = 'Handing off the file now...';
        // var url = (window.URL || window.webkitURL).createObjectURL(blob);
        // var link = window.document.createElement('a');
        // link.href = url;
        // link.download = 'output.wav';
        // var click = document.createEvent("Event");
        // click.initEvent("click", true, true);
        // link.dispatchEvent(click);
        yourButton.removeClass("recording");
    } else {
        // start recording
        yourButton.addClass("recording");
        recording = true;
        // reset the buffers for the new recording
        leftchannel.length = rightchannel.length = 0;
        recordingLength = 0;
        outputElement.innerHTML = 'Recording now...';
    }
}

function interleave(leftChannel, rightChannel){
  var length = leftChannel.length + rightChannel.length;
  var result = new Float32Array(length);

  var inputIndex = 0;

  for (var index = 0; index < length; ){
    result[index++] = leftChannel[inputIndex];
    result[index++] = rightChannel[inputIndex];
    inputIndex++;
  }
  return result;
}

function mergeBuffers(channelBuffer, recordingLength){
  var result = new Float32Array(recordingLength);
  var offset = 0;
  var lng = channelBuffer.length;
  for (var i = 0; i < lng; i++){
    var buffer = channelBuffer[i];
    result.set(buffer, offset);
    offset += buffer.length;
  }
  return result;
}

function writeUTFBytes(view, offset, string){ 
  var lng = string.length;
  for (var i = 0; i < lng; i++){
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function success(e){
    // creates the audio context
    audioContext = window.AudioContext || window.webkitAudioContext;
    context = new audioContext();

    // we query the context sample rate (varies depending on platforms)
    sampleRate = context.sampleRate;

    console.log('succcess');
    
    // creates a gain node
    volume = context.createGain();

    // creates an audio node from the microphone incoming stream
    audioInput = context.createMediaStreamSource(e);

    // connect the stream to the gain node
    audioInput.connect(volume);

    /* From the spec: This value controls how frequently the audioprocess event is 
    dispatched and how many sample-frames need to be processed each call. 
    Lower values for buffer size will result in a lower (better) latency. 
    Higher values will be necessary to avoid audio breakup and glitches */
    var bufferSize = 2048;
    if (window.innerWidth <= 770) {
        bufferSize = 4096;
    }
    recorder = context.createScriptProcessor(bufferSize, 2, 2);

    recorder.onaudioprocess = function(e){
        if (!recording) return;
        var left = e.inputBuffer.getChannelData (0);
        var right = e.inputBuffer.getChannelData (1);

        // we clone the samples
        leftchannel.push (new Float32Array (left));
        rightchannel.push (new Float32Array (right));
        recordingLength += bufferSize;
        console.log('recording');
    }

    // we connect the recorder
    volume.connect (recorder);
    recorder.connect (context.destination); 
}

function uploadToSurvey(blob) {
    
    // ATTACH MY BLOB TO A FORM (SE)
    var fd = new FormData();
    fd.append('clip', blob, fileName);

    // HIT MY UPLOAD SERVICE
    $.ajax({
        type: 'POST',
        url: "/uploadAudio",
        data: fd,
        headers: { 
            Accept : "application/json"
        },
        processData: false,
        contentType: false,
    }).done(function(data) {
        console.log(data);
        outputElement.innerHTML = 'File upload complete!';        
    });
    
}