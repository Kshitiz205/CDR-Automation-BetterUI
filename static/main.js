(function () {
  const dzInput  = document.getElementById('dz-input');
  const dzMaster = document.getElementById('dz-master');
  const fileInput  = document.getElementById('file-input');
  const fileMaster = document.getElementById('file-master');
  const nameInput  = document.getElementById('dz-input-name');
  const nameMaster = document.getElementById('dz-master-name');
  const btnGenerate = document.getElementById('btn-generate');
  const outputName  = document.getElementById('output-name');
  const progressWrap = document.getElementById('progress-wrap');
  const progressFill = document.getElementById('progress-fill');
  const logEl = document.getElementById('log');
  const errorBox = document.getElementById('error-box');
  const dlBox = document.getElementById('dl-box');
  const dlTitle = document.getElementById('dl-title');
  const dlSub = document.getElementById('dl-sub');
  const dlStats = document.getElementById('dl-stats');
  const btnDownload = document.getElementById('btn-download');

  let inputFile = null;
  let masterFile = null;
  let currentJobId = null;

  function setupDropzone(dz, input, nameEl, onSet) {
    dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag'));
    dz.addEventListener('drop', (e) => {
      e.preventDefault();
      dz.classList.remove('drag');
      if (e.dataTransfer.files.length) {
        input.files = e.dataTransfer.files;
        handleFile(e.dataTransfer.files[0]);
      }
    });
    input.addEventListener('change', () => {
      if (input.files.length) handleFile(input.files[0]);
    });
    function handleFile(file) {
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        nameEl.textContent = '⚠ Please upload a .xlsx file';
        nameEl.style.color = '#fca5a5';
        onSet(null);
        return;
      }
      nameEl.style.color = '';
      nameEl.textContent = '✓ ' + file.name;
      dz.classList.add('filled');
      onSet(file);
    }
  }

  setupDropzone(dzInput, fileInput, nameInput, (f) => { inputFile = f; updateBtn(); });
  setupDropzone(dzMaster, fileMaster, nameMaster, (f) => { masterFile = f; updateBtn(); });

  function updateBtn() {
    if (inputFile && masterFile) {
      btnGenerate.disabled = false;
      btnGenerate.textContent = 'Generate CDR Final';
    } else {
      btnGenerate.disabled = true;
      btnGenerate.textContent = 'Upload both files to continue';
    }
  }

  const STEP_ICONS = {
    "Loading MTD lookup tables…": "",
    "Parsing session data…": "",
    "Applying TU / UU / MAC filters…": "",
    "Building pivot tables…": "",
    "Writing 11 Excel sheets…": "",
    "Finalising output file…": "",
    "Done!": ""
  };

  let seenSteps = [];

  function renderLog(currentStep, isDone) {
    if (currentStep && !seenSteps.includes(currentStep)) {
      seenSteps.push(currentStep);
    }
    logEl.innerHTML = seenSteps.map((step, i) => {
      const isLast = i === seenSteps.length - 1;
      const done = isDone || !isLast;
      const icon = done ? '✓' : (STEP_ICONS[step] || '•');
      const cls = done ? 'done' : 'active';
      return `<div class="log-row ${cls}"><span class="log-icon">${icon}</span>${step}</div>`;
    }).join('');
  }

  async function poll(jobId) {
    try {
      const res = await fetch(`/status/${jobId}`);
      const data = await res.json();

      if (data.status === 'error') {
        errorBox.textContent = '❌ Error: ' + data.error;
        errorBox.classList.add('show');
        progressWrap.classList.remove('show');
        btnGenerate.disabled = false;
        btnGenerate.textContent = 'Generate CDR Final';
        return;
      }

      progressFill.style.width = (data.progress || 0) + '%';
      renderLog(data.step, data.status === 'done');

      if (data.status === 'done') {
        showResult(jobId, data.stats);
        btnGenerate.disabled = false;
        btnGenerate.textContent = 'Generate CDR Final';
        return;
      }

      setTimeout(() => poll(jobId), 500);
    } catch (err) {
      errorBox.textContent = '❌ Connection error: ' + err.message;
      errorBox.classList.add('show');
      progressWrap.classList.remove('show');
      btnGenerate.disabled = false;
      btnGenerate.textContent = 'Generate CDR Final';
    }
  }

  function showResult(jobId, stats) {
    let fname = (outputName.value.trim() || 'CDR_Final_Output');
    if (!fname.endsWith('.xlsx')) fname += '.xlsx';

    dlTitle.textContent = `Report ready — ${fname}`;
    dlSub.textContent = `CDR date: ${stats.date} · ${stats.sheets} sheets generated`;
    dlStats.innerHTML = `
      <div><div class="dl-stat-n">${stats.sessions.toLocaleString()}</div><div class="dl-stat-l">Sessions</div></div>
      <div><div class="dl-stat-n">${stats.bts.toLocaleString()}</div><div class="dl-stat-l">BTS Sites</div></div>
      <div><div class="dl-stat-n">${stats.tu.toLocaleString()}</div><div class="dl-stat-l">TU rows</div></div>
      <div><div class="dl-stat-n">${stats.uu.toLocaleString()}</div><div class="dl-stat-l">UU rows</div></div>
      <div><div class="dl-stat-n">${stats.mac_tu.toLocaleString()}</div><div class="dl-stat-l">MAC TU</div></div>
      <div><div class="dl-stat-n">${stats.mac_uu.toLocaleString()}</div><div class="dl-stat-l">MAC UU</div></div>
    `;
    dlBox.classList.add('show');

    btnDownload.onclick = () => {
      window.location.href = `/download/${jobId}?filename=${encodeURIComponent(fname)}`;
    };
  }

  btnGenerate.addEventListener('click', async () => {
    if (!inputFile || !masterFile) return;

    errorBox.classList.remove('show');
    dlBox.classList.remove('show');
    seenSteps = [];
    logEl.innerHTML = '';
    progressFill.style.width = '0%';
    progressWrap.classList.add('show');
    btnGenerate.disabled = true;
    btnGenerate.textContent = 'Generating…';

    const formData = new FormData();
    formData.append('input_file', inputFile);
    formData.append('master_file', masterFile);

    try {
      const res = await fetch('/generate', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) {
        errorBox.textContent = '❌ ' + data.error;
        errorBox.classList.add('show');
        progressWrap.classList.remove('show');
        btnGenerate.disabled = false;
        btnGenerate.textContent = 'Generate CDR Final';
        return;
      }
      currentJobId = data.job_id;
      poll(currentJobId);
    } catch (err) {
      errorBox.textContent = '❌ ' + err.message;
      errorBox.classList.add('show');
      progressWrap.classList.remove('show');
      btnGenerate.disabled = false;
      btnGenerate.textContent = 'Generate CDR Final';
    }
  });
})();
