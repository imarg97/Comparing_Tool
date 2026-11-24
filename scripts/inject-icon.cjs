const fs = require('fs');
const path = require('path');
const ResEdit = require('resedit');

const repoDir = path.resolve(__dirname, '..');
const icoPath = path.join(repoDir, 'public', 'icon.ico');

function injectIcon(exePath) {
  if (!fs.existsSync(exePath) || !fs.existsSync(icoPath)) {
    console.log('Skipping PE icon injection (missing file):', exePath);
    return;
  }
  try {
    const exeBuf = fs.readFileSync(exePath);
    const exe = ResEdit.NtExecutable.from(exeBuf);
    const res = ResEdit.NtExecutableResource.from(exe);
    const iconBuf = fs.readFileSync(icoPath);
    const iconFile = ResEdit.Data.IconFile.from(iconBuf);

    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
      res.entries,
      1,
      1033,
      iconFile.icons.map(i => i.data)
    );

    res.outputResource(exe);
    const outBuf = Buffer.from(exe.generate());
    fs.writeFileSync(exePath, outBuf);
    console.log(`SUCCESS: Embedded PE icon into ${path.basename(exePath)} (${outBuf.length} bytes)`);
  } catch (err) {
    console.error(`Error injecting icon into ${exePath}:`, err);
  }
}

injectIcon(path.join(repoDir, 'release', 'win-unpacked', 'mDiff.exe'));
injectIcon(path.join(repoDir, 'release', 'win-arm64-unpacked', 'mDiff.exe'));
