// mp3.js requires window, but we're a workor
var window = this;
importScripts("aurora.js", "mp3.js", "dsp.js", "beatdetektor.js");

// remove the console, beatdetektor is spamming it
console = undefined;

AV.Asset.prototype.decodeDurationToBuffer = function(time) {
    return new Promise(function(resolve, reject) {
	var buffer, duration, offset, finish, dataHandler, format;
	duration = time;
	buffer = null;
	offset = 0;
	var finish = function() {
	    this.stop();
	    this.off('buffer', dataHandler);
	    return resolve({ buffer: buffer.subarray(0, offset), format: format });
	}.bind(this);

	this.on('error', function (e) {
	    this.stop();
	    this.off('buffer', dataHandler);
	    reject(e);
	});

	this.once('format', function(f) {
	    var size;
	    format = f;
	    size = format.channelsPerFrame * format.sampleRate * duration;
	    buffer = new Float32Array(size);
	});

	this.on('data', dataHandler = function(chunk) {
	    var size;
	    if (offset < buffer.length) {
		size = Math.min(buffer.length - offset, chunk.length);
		buffer.set(chunk.subarray(0, size), offset);
		offset += size;
	    } else {
		finish();
	    }
	});

	this.once('end', finish);
	this.start();
    }.bind(this));
};

onmessage = function (e) {
  var t = new Date();
  decode(e.data.file).then(analyze).then(function (bpm) {
      postMessage({ message: bpm + " BPM" });
      postMessage({ message: (new Date() - t) + " ms" });
  });
};

function handleError(e) {
    postMessage({ message: "error occurred " + e });
}

function analyze({buffer, format}) {
    var fft, rounds, frameSize, i, bd_low, bd_med, bd_high, data, timer, roundTime;
    frameSize = 1024;
    timer = 0;
    roundTime = frameSize / format.sampleRate;

    buffer = DSP.getChannel(DSP.MIX, buffer);
    rounds = Math.floor(buffer.length / frameSize)
    fft = new FFT(frameSize, format.sampleRate);

    bd_low = new BeatDetektor(48,95);
    bd_med = new BeatDetektor(85,169);
    bd_high = new BeatDetektor(150,280);

    for (i = 0; i < rounds; ++i) {
	fft.forward(buffer.subarray(i * 1024, (i + 1) * 1024));
	data = fft.spectrum;
	bd_low.process(timer, data);
	bd_med.process(timer, data);
	bd_high.process(timer, data);

	timer += roundTime;
    }

    return Promise.resolve([bd_low, bd_med, bd_high].sort(function(a, b) {
	return Math.sign(a.quality_total - b.quality_total);
    })[2].win_bpm_int_lo);
}

function decode(url) {
    return AV.Asset.fromURL(url).decodeDurationToBuffer(30);
}
