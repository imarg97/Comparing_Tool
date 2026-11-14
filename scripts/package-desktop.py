import os
import zipfile

REPO_DIR = '/Users/anuabhi/.gemini/antigravity/scratch/diffx'
RELEASE_DIR = os.path.join(REPO_DIR, 'release')

def clean_zip_folder(src_dir, zip_path, root_prefix=''):
    if os.path.exists(zip_path):
        os.remove(zip_path)
    print(f"Creating {os.path.basename(zip_path)} from {src_dir}...")
    with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(src_dir):
            dirs[:] = sorted([d for d in dirs if not d.startswith('._') and d != '.DS_Store'])
            files = sorted([f for f in files if not f.startswith('._') and f != '.DS_Store'])
            rel_dir = os.path.relpath(root, src_dir)

            for f in files:
                full_p = os.path.join(root, f)
                if root_prefix:
                    arc_name = os.path.normpath(os.path.join(root_prefix, '' if rel_dir == '.' else rel_dir, f))
                else:
                    arc_name = os.path.normpath(os.path.join('' if rel_dir == '.' else rel_dir, f))
                
                # Check permissions
                zi = zipfile.ZipInfo(arc_name)
                zi.date_time = (2026, 11, 14, 0, 0, 0)
                st = os.stat(full_p)
                zi.external_attr = (st.st_mode & 0o777) << 16
                with open(full_p, 'rb') as fp:
                    zf.writestr(zi, fp.read())
    print(f"Done: {zip_path} ({os.path.getsize(zip_path)} bytes)")

if __name__ == '__main__':
    clean_zip_folder(
        os.path.join(RELEASE_DIR, 'win-unpacked'),
        os.path.join(RELEASE_DIR, 'mDiff-windows-x64.zip'),
        'mDiff-windows-x64'
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
