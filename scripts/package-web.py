import os
import tarfile
import zipfile

REPO_DIR = '/Users/anuabhi/.gemini/antigravity/scratch/diffx'
DEPLOY_DIR = os.path.join(REPO_DIR, 'deploy')
RELEASE_DIR = os.path.join(REPO_DIR, 'release')
TAR_PATH = os.path.join(RELEASE_DIR, 'mDiff-internal-web-deployment.tar.gz')
ZIP_PATH = os.path.join(RELEASE_DIR, 'mDiff-internal-web-deployment.zip')

# Clean out any .DS_Store or ._* files in deploy directory
for root, dirs, files in os.walk(DEPLOY_DIR):
    for f in files:
        if f.startswith('._') or f == '.DS_Store':
            try:
                os.remove(os.path.join(root, f))
            except Exception:
                pass

# Create clean tar.gz with root folder 'mdiff/'
# Use GNU_FORMAT to ensure maximum compatibility with Linux GNU tar
with tarfile.open(TAR_PATH, 'w:gz', format=tarfile.GNU_FORMAT) as tar:
    # Add root directory
    root_ti = tarfile.TarInfo(name='mdiff')
    root_ti.type = tarfile.DIRTYPE
    root_ti.mode = 0o755
    root_ti.uname = 'root'
    root_ti.gname = 'root'
    root_ti.uid = 0
    root_ti.gid = 0
    tar.addfile(root_ti)

    for root, dirs, files in os.walk(DEPLOY_DIR):
        dirs[:] = sorted([d for d in dirs if not d.startswith('._') and d != '.DS_Store'])
        files = sorted([f for f in files if not f.startswith('._') and f != '.DS_Store'])
        rel_dir = os.path.relpath(root, DEPLOY_DIR)

        for d in dirs:
            dir_rel = os.path.normpath(os.path.join('mdiff', '' if rel_dir == '.' else rel_dir, d))
            ti = tarfile.TarInfo(name=dir_rel)
            ti.type = tarfile.DIRTYPE
            ti.mode = 0o755
            ti.uname = 'root'
            ti.gname = 'root'
            ti.uid = 0
            ti.gid = 0
            tar.addfile(ti)

        for f in files:
            full_p = os.path.join(root, f)
            arc_name = os.path.normpath(os.path.join('mdiff', '' if rel_dir == '.' else rel_dir, f))
            ti = tarfile.TarInfo(name=arc_name)
            ti.size = os.path.getsize(full_p)
            ti.mtime = int(os.path.getmtime(full_p))
            ti.uname = 'root'
            ti.gname = 'root'
            ti.uid = 0
            ti.gid = 0
            if f.endswith('.sh') or f.endswith('.py'):
                ti.mode = 0o755
            else:
                ti.mode = 0o644
            with open(full_p, 'rb') as fp:
                tar.addfile(ti, fp)

# Create clean zip with root folder 'mdiff/'
if os.path.exists(ZIP_PATH):
    os.remove(ZIP_PATH)

with zipfile.ZipFile(ZIP_PATH, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(DEPLOY_DIR):
        dirs[:] = sorted([d for d in dirs if not d.startswith('._') and d != '.DS_Store'])
        files = sorted([f for f in files if not f.startswith('._') and f != '.DS_Store'])
        rel_dir = os.path.relpath(root, DEPLOY_DIR)

        for f in files:
            full_p = os.path.join(root, f)
            arc_name = os.path.normpath(os.path.join('mdiff', '' if rel_dir == '.' else rel_dir, f))
            zi = zipfile.ZipInfo(arc_name)
            zi.date_time = (2026, 11, 14, 0, 0, 0)
            if f.endswith('.sh') or f.endswith('.py'):
                zi.external_attr = 0o755 << 16
            else:
                zi.external_attr = 0o644 << 16
            with open(full_p, 'rb') as fp:
                zf.writestr(zi, fp.read())

print("SUCCESS: Web deployment packaged with mdiff/ root folder and zero Apple metadata.")
