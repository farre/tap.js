// mp3.js requires window, but we're a workor
var window = this;
importScripts("aurora.js", "mp3.js", "dsp.js", "beatdetektor.js");

// remove the console, beatdetektor is spamming it
console = undefined;

AV.Asset.prototype.decodeDurationToBuffer = function(duration, callback) {
    var buffer, duration, offset, finish, dataHandler, format;
    buffer = null;
    offset = 0;
    var finish = function() {
	this.stop();
	this.off('buffer', dataHandler);
	return callback(buffer.subarray(0, offset), format);
    }

    this.once('format', function(f) {
	format = f;
	buffer = new Float32Array(format.channelsPerFrame * format.sampleRate * duration);
    });

    this.on('data', dataHandler = function(chunk) {
	var size;
	if (offset < buffer.length) {
	    size = Math.min(buffer.length - offset, chunk.length);
	    buffer.set(chunk.subarray(0, size), offset);
	    offset += size;
	} else {
	    finish.call(this);
	}
    });

    this.once('end', finish);

    return this.start();
};

onmessage = function (e) {
  decode(e.data.file);
};

function handleError(e) {
    postMessage({ message: "error occurred " + e });
}

function handleData(buffer, format) {
    postMessage({ message: "start analyzing" });
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

    postMessage({ message: (bd_low.win_bpm_int/10.0)+" BPM / "+(bd_low.win_bpm_int_lo)+" BPM, quality = " + bd_low.quality_total });
    postMessage({ message: (bd_med.win_bpm_int/10.0)+" BPM / "+(bd_med.win_bpm_int_lo)+" BPM, quality = " + bd_med.quality_total });
    postMessage({ message: (bd_high.win_bpm_int/10.0)+" BPM / "+(bd_high.win_bpm_int_lo)+" BPM, quality = " + bd_high.quality_total });
    postMessage({ message: "done analyzing" });
}

function decode(url) {
    var asset;

    postMessage({ message: "start decoding " + url });
    asset = AV.Asset.fromURL(url);
    asset.decodeDurationToBuffer(30, handleData);
    asset.start();
}
