import os
import shutil
import zipfile
import stat

REPO_DIR = '/Users/anuabhi/.gemini/antigravity/scratch/diffx'
RELEASE_DIR = os.path.join(REPO_DIR, 'release')

def clean_zip_folder(src_dir, zip_path, root_prefix=''):
    if os.path.exists(zip_path):
        os.remove(zip_path)
    print(f"Creating {os.path.basename(zip_path)} from {src_dir}...")
    written_dirs = set()
    with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        if root_prefix:
            norm_root = root_prefix.replace('\\', '/').strip('/') + '/'
            zi_root = zipfile.ZipInfo(norm_root)
            zi_root.date_time = (2026, 11, 24, 0, 0, 0)
            zi_root.external_attr = ((stat.S_IFDIR | 0o777) << 16) | 0x10
            zf.writestr(zi_root, '')
            written_dirs.add(norm_root)

        for root, dirs, files in os.walk(src_dir):
            dirs[:] = sorted([d for d in dirs if not d.startswith('._') and d != '.DS_Store'])
            files = sorted([f for f in files if not f.startswith('._') and f != '.DS_Store'])
            rel_dir = os.path.relpath(root, src_dir)

            # Ensure all subdirectories have explicit entries with valid FAT/POSIX directory attributes
            for d in dirs:
                sub_rel = d if rel_dir == '.' else os.path.join(rel_dir, d)
                d_arc = os.path.join(root_prefix, sub_rel) if root_prefix else sub_rel
                d_arc = d_arc.replace('\\', '/').strip('/') + '/'
                if d_arc not in written_dirs:
                    zi_d = zipfile.ZipInfo(d_arc)
                    zi_d.date_time = (2026, 11, 24, 0, 0, 0)
                    zi_d.external_attr = ((stat.S_IFDIR | 0o777) << 16) | 0x10
                    zf.writestr(zi_d, '')
                    written_dirs.add(d_arc)

            for f in files:
                full_p = os.path.join(root, f)
                arc_name = os.path.join(root_prefix, '' if rel_dir == '.' else rel_dir, f) if root_prefix else os.path.join('' if rel_dir == '.' else rel_dir, f)
                arc_name = arc_name.replace('\\', '/')
                
                # Check permissions & ensure standard S_IFREG + FAT archive attributes
                zi = zipfile.ZipInfo(arc_name)
                zi.date_time = (2026, 11, 24, 0, 0, 0)
                st = os.stat(full_p)
                # Ensure 0777 full read/write/execute for all users and processes
                mode = 0o777
                zi.external_attr = ((stat.S_IFREG | mode) << 16) | 0x20
                with open(full_p, 'rb') as fp:
                    zf.writestr(zi, fp.read())
    print(f"Done: {zip_path} ({os.path.getsize(zip_path)} bytes)")

if __name__ == '__main__':
    # 0. Sync fresh app.asar and physical icons into unpacked distribution folders
    mac_asar = os.path.join(RELEASE_DIR, 'mac-arm64', 'mDiff.app', 'Contents', 'Resources', 'app.asar')
    ico_src = os.path.join(REPO_DIR, 'public', 'icon.ico')
    png_src = os.path.join(REPO_DIR, 'public', 'icon.png')
    for target in ['win-unpacked', 'win-arm64-unpacked']:
        tdir = os.path.join(RELEASE_DIR, target)
        rdir = os.path.join(tdir, 'resources')
        if os.path.exists(tdir) and os.path.exists(rdir):
            if os.path.exists(mac_asar):
                shutil.copyfile(mac_asar, os.path.join(rdir, 'app.asar'))
            if os.path.exists(ico_src):
                shutil.copyfile(ico_src, os.path.join(rdir, 'icon.ico'))
                shutil.copyfile(ico_src, os.path.join(tdir, 'icon.ico'))
            if os.path.exists(png_src):
                shutil.copyfile(png_src, os.path.join(rdir, 'icon.png'))
                shutil.copyfile(png_src, os.path.join(tdir, 'icon.png'))

    # 1. Build NSIS Windows Program Files Installers if makensis is present
    makensis_bin = '/opt/homebrew/bin/makensis'
    nsi_script = os.path.join(REPO_DIR, 'scripts', 'installer.nsi')
    if os.path.exists(makensis_bin) and os.path.exists(nsi_script):
        print("Compiling Windows x64 Program Files Setup Installer...")
        os.system(f"{makensis_bin} -DOUTFILE=../release/mDiff-Setup-5.1.0.exe -DSRCDIR=../release/win-unpacked {nsi_script}")
        shutil.copyfile(
            os.path.join(RELEASE_DIR, 'mDiff-Setup-5.1.0.exe'),
            os.path.join(RELEASE_DIR, 'mDiff-Setup-x64.exe')
        )
        print("Compiling Windows arm64 Program Files Setup Installer...")
        os.system(f"{makensis_bin} -DOUTFILE=../release/mDiff-Setup-arm64.exe -DSRCDIR=../release/win-arm64-unpacked {nsi_script}")

    # 2. Package Portable Packages
    clean_zip_folder(
        os.path.join(RELEASE_DIR, 'win-unpacked'),
        os.path.join(RELEASE_DIR, 'mDiff-windows-x64.zip'),
        'mDiff-windows-x64'
    )
    clean_zip_folder(
        os.path.join(RELEASE_DIR, 'win-unpacked'),
        os.path.join(RELEASE_DIR, 'mDiff-v5.1_Tool.zip'),
        'mDiff-v5.1_Tool'
    )
    clean_zip_folder(
        os.path.join(RELEASE_DIR, 'win-arm64-unpacked'),
        os.path.join(RELEASE_DIR, 'mDiff-windows-arm64.zip'),
        'mDiff-windows-arm64'
    )
    clean_zip_folder(
        os.path.join(RELEASE_DIR, 'mac-arm64', 'mDiff.app'),
        os.path.join(RELEASE_DIR, 'mDiff-macOS-arm64.zip'),
        'mDiff.app'
    )
