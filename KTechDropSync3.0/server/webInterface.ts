export function getWebInterface(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <title>KTech DropSync Elite Edition</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);min-height:100vh;padding:0 0 24px}
    .header{text-align:center;color:#fff;padding:28px 16px 20px}
    .header h1{font-size:1.7em;font-weight:800;letter-spacing:-0.5px}
    .header .sub{opacity:.85;margin-top:4px;font-size:.9em}
    .header .tag{opacity:.65;margin-top:2px;font-size:.8em}
    .card{background:#fff;border-radius:18px;padding:20px;margin:0 12px 14px;box-shadow:0 8px 32px rgba(0,0,0,.15)}
    h2{color:#764ba2;font-size:1em;font-weight:700;margin-bottom:14px;border-bottom:2px solid #667eea;padding-bottom:8px;display:flex;align-items:center;gap:8px}
    .dropzone{border:2px dashed #b3a8e8;border-radius:12px;padding:28px 16px;text-align:center;cursor:pointer;transition:background .2s;margin-bottom:12px}
    .dropzone.hover{background:rgba(102,126,234,.08);border-color:#667eea}
    .dropzone-icon{font-size:2em;margin-bottom:8px}
    .dropzone-text{color:#764ba2;font-weight:600;font-size:.95em}
    .dropzone-sub{color:#999;font-size:.8em;margin-top:4px}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;border:none;padding:10px 18px;border-radius:10px;cursor:pointer;font-size:.88em;font-weight:600;transition:opacity .15s;text-decoration:none;width:100%}
    .btn:hover{opacity:.88}
    .btn-sm{width:auto;padding:6px 12px;font-size:.8em;border-radius:8px}
    .btn-danger{background:#ef4444}
    .btn-outline{background:transparent;border:1.5px solid #667eea;color:#667eea}
    .file-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8f7ff;border-radius:10px;margin-bottom:8px}
    .file-icon{font-size:1.6em;flex-shrink:0}
    .file-info{flex:1;min-width:0}
    .file-name{font-weight:600;font-size:.85em;color:#1a1030;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .file-size{color:#888;font-size:.75em;margin-top:2px}
    .file-actions{display:flex;gap:6px;flex-shrink:0}
    .progress-item{background:#f8f7ff;border-radius:10px;padding:10px 12px;margin-top:8px;border-left:3px solid #667eea}
    .progress-name{font-weight:600;font-size:.85em;color:#1a1030;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    progress{width:100%;height:6px;border-radius:3px;appearance:none}
    progress::-webkit-progress-bar{background:#e5e7eb;border-radius:3px}
    progress::-webkit-progress-value{background:linear-gradient(90deg,#667eea,#764ba2);border-radius:3px}
    .progress-pct{font-size:.75em;color:#667eea;font-weight:600;margin-top:4px}
    .empty{text-align:center;color:#bbb;padding:20px 0;font-size:.9em;font-style:italic}
    .badge{display:inline-flex;align-items:center;justify-content:center;background:#667eea;color:#fff;font-size:.7em;font-weight:700;width:20px;height:20px;border-radius:50%;flex-shrink:0}
    textarea{width:100%;padding:12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:.9em;resize:vertical;min-height:80px;font-family:inherit;outline:none;transition:border .15s}
    textarea:focus{border-color:#667eea}
    .text-item{background:#f8f7ff;border-radius:10px;padding:12px;margin-bottom:8px;border-left:3px solid #667eea}
    .text-source{font-size:.7em;font-weight:700;color:#667eea;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
    .text-content{font-size:.85em;color:#1a1030;word-break:break-word;line-height:1.4}
    .text-actions{display:flex;gap:6px;margin-top:8px}
    .footer{text-align:center;color:rgba(255,255,255,.75);padding:8px 16px;font-size:.78em;margin-top:4px}
    .status-dot{width:8px;height:8px;border-radius:50%;background:#22c55e;display:inline-block;margin-right:4px;animation:pulse 2s infinite}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
  </style>
</head>
<body>
  <div class="header">
    <div class="status-dot"></div>
    <h1>KTech DropSync Elite Edition</h1>
    <div class="sub">Solutions by Innovations</div>
    <div class="tag">Made by KTech Solutions with Love</div>
  </div>

  <div class="card">
    <h2><span>📤</span> Upload Files to Phone</h2>
    <div class="dropzone" id="dropzone">
      <div class="dropzone-icon">📁</div>
      <div class="dropzone-text">Drop files here or tap to browse</div>
      <div class="dropzone-sub">Supports all file types &bull; Multiple files</div>
    </div>
    <input type="file" id="fileInput" multiple style="display:none">
    <button class="btn" onclick="document.getElementById('fileInput').click()">Choose Files to Upload</button>
    <div id="uploadProgress"></div>
  </div>

  <div class="card">
    <h2><span>📱</span> Files from Phone <span class="badge" id="sharedBadge">0</span></h2>
    <div id="sharedFilesList"><div class="empty">No files shared yet. Add files in the app.</div></div>
  </div>

  <div class="card">
    <h2><span>💾</span> Uploaded to Phone <span class="badge" id="uploadedBadge">0</span></h2>
    <div id="uploadedFilesList"><div class="empty">No uploads yet. Upload files above.</div></div>
  </div>

  <div class="card">
    <h2><span>💬</span> Text Exchange</h2>
    <textarea id="textInput" placeholder="Type text to send to phone clipboard..."></textarea>
    <button class="btn" onclick="sendText()" style="margin-top:8px">Send to Phone</button>
    <div id="textsFromPhone" style="margin-top:14px"></div>
  </div>

  <div class="footer">KTech DropSync Elite Edition &bull; Local Network File Sharing</div>

  <script>
    var refreshTimer = null;

    function formatSize(bytes) {
      if (!bytes || bytes === 0) return '0 B';
      var sizes = ['B', 'KB', 'MB', 'GB'];
      var i = Math.floor(Math.log(bytes) / Math.log(1024));
      return parseFloat((bytes / Math.pow(1024, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function getFileIcon(name) {
      var ext = (name.split('.').pop() || '').toLowerCase();
      var icons = {
        pdf:'📄',doc:'📝',docx:'📝',xls:'📊',xlsx:'📊',ppt:'📊',pptx:'📊',
        mp3:'🎵',wav:'🎵',mp4:'🎬',mov:'🎬',avi:'🎬',mkv:'🎬',
        jpg:'🖼',jpeg:'🖼',png:'🖼',gif:'🖼',webp:'🖼',svg:'🖼',
        zip:'🗜',rar:'🗜',apk:'📱',txt:'📄'
      };
      return icons[ext] || '📁';
    }

    function escapeHtml(str) {
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    }

    function loadData() {
      Promise.all([
        fetch('/api/files/shared').then(function(r) { return r.json(); }).catch(function() { return {files:[]}; }),
        fetch('/api/files/uploaded').then(function(r) { return r.json(); }).catch(function() { return {files:[]}; }),
        fetch('/api/texts').then(function(r) { return r.json(); }).catch(function() { return {texts:[]}; })
      ]).then(function(results) {
        renderShared(results[0].files || []);
        renderUploaded(results[1].files || []);
        renderTexts(results[2].texts || []);
      });
    }

    function renderShared(files) {
      document.getElementById('sharedBadge').textContent = files.length;
      var container = document.getElementById('sharedFilesList');
      if (!files.length) { container.innerHTML = '<div class="empty">No files shared yet. Add files in the app.</div>'; return; }
      container.innerHTML = files.map(function(f) {
        return '<div class="file-item">' +
          '<div class="file-icon">' + getFileIcon(f.name) + '</div>' +
          '<div class="file-info"><div class="file-name">' + escapeHtml(f.name) + '</div><div class="file-size">' + formatSize(f.size) + '</div></div>' +
          '<div class="file-actions">' +
          '<a class="btn btn-sm" href="/api/download/shared/' + encodeURIComponent(f.name) + '" download="' + escapeHtml(f.name) + '">Download</a>' +
          '</div></div>';
      }).join('');
    }

    function renderUploaded(files) {
      document.getElementById('uploadedBadge').textContent = files.length;
      var container = document.getElementById('uploadedFilesList');
      if (!files.length) { container.innerHTML = '<div class="empty">No uploads yet.</div>'; return; }
      container.innerHTML = files.map(function(f) {
        return '<div class="file-item">' +
          '<div class="file-icon">' + getFileIcon(f.name) + '</div>' +
          '<div class="file-info"><div class="file-name">' + escapeHtml(f.name) + '</div><div class="file-size">' + formatSize(f.size) + '</div></div>' +
          '</div>';
      }).join('');
    }

    function renderTexts(texts) {
      var container = document.getElementById('textsFromPhone');
      var phoneTexts = texts.filter(function(t) { return t.source === 'phone'; });
      if (!phoneTexts.length) { container.innerHTML = ''; return; }
      container.innerHTML = '<div style="font-size:.8em;font-weight:700;color:#764ba2;margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">From Phone:</div>' +
        phoneTexts.map(function(t) {
          return '<div class="text-item">' +
            '<div class="text-content">' + escapeHtml(t.text) + '</div>' +
            '<div class="text-actions">' +
            '<button class="btn btn-sm btn-outline" onclick="copyToClipboard(\'' + escapeHtml(t.text.replace(/'/g, "\\'" )) + '\')">Copy</button>' +
            '</div></div>';
        }).join('');
    }

    function copyToClipboard(text) {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() { alert('Copied!'); });
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        alert('Copied!');
      }
    }

    function sendText() {
      var text = document.getElementById('textInput').value.trim();
      if (!text) return;
      fetch('/api/text', {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'text=' + encodeURIComponent(text)
      }).then(function(r) { return r.json(); }).then(function() {
        document.getElementById('textInput').value = '';
        alert('Text sent to phone!');
      }).catch(function() { alert('Failed to send text.'); });
    }

    function uploadFile(file) {
      var container = document.getElementById('uploadProgress');
      var div = document.createElement('div');
      div.className = 'progress-item';
      div.innerHTML = '<div class="progress-name">' + escapeHtml(file.name) + '</div><progress value="0" max="100"></progress><div class="progress-pct">Starting...</div>';
      container.appendChild(div);
      var bar = div.querySelector('progress');
      var pct = div.querySelector('.progress-pct');
      var fd = new FormData();
      fd.append('file', file);
      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload', true);
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          var p = Math.round(e.loaded / e.total * 100);
          bar.value = p;
          pct.textContent = p + '%';
        }
      };
      xhr.onload = function() {
        bar.value = 100;
        pct.textContent = 'Done!';
        pct.style.color = '#22c55e';
        setTimeout(function() { div.remove(); loadData(); }, 1500);
      };
      xhr.onerror = function() { pct.textContent = 'Failed'; pct.style.color = '#ef4444'; };
      xhr.send(fd);
    }

    document.getElementById('fileInput').addEventListener('change', function(e) {
      Array.from(e.target.files).forEach(uploadFile);
      e.target.value = '';
    });

    var dz = document.getElementById('dropzone');
    dz.addEventListener('click', function() { document.getElementById('fileInput').click(); });
    dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.classList.add('hover'); });
    dz.addEventListener('dragleave', function() { dz.classList.remove('hover'); });
    dz.addEventListener('drop', function(e) {
      e.preventDefault();
      dz.classList.remove('hover');
      Array.from(e.dataTransfer.files).forEach(uploadFile);
    });

    loadData();
    refreshTimer = setInterval(loadData, 5000);
  </script>
</body>
</html>`;
}
