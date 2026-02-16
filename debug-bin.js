const ffprobe = require('ffprobe-static');
const ffmpeg = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

console.log('CWD:', process.cwd());
console.log('ffprobe-static path:', ffprobe.path);
console.log('ffmpeg-static path:', ffmpeg);

if (fs.existsSync(ffprobe.path)) {
    console.log('✅ ffprobe binary exists');
} else {
    console.log('❌ ffprobe binary MISSING at', ffprobe.path);
}

// Check local node_modules manually
const localPath = path.join(process.cwd(), 'node_modules', 'ffprobe-static', 'bin', process.platform, process.arch, 'ffprobe');
if (fs.existsSync(localPath)) {
    console.log('✅ Local ffprobe binary exists at', localPath);
} else {
    console.log('❌ Local ffprobe binary MISSING at', localPath);
}
