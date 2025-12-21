console.log('home script running');

let autoStart = '0';
let aiModel = 'gemini-2.5-flash';

function updateApiKeyStatus(keyName, statusElement, inputElement) {
  const value = inputElement.value.trim();
  if (value && value !== 'null') {
    statusElement.textContent = '(Present)';
    statusElement.className = 'api-key-status present';
  } else {
    statusElement.textContent = '(Missing)';
    statusElement.className = 'api-key-status missing';
  }
}

function loadApiKeysFromStorage() {
  chrome.storage.local.get(['C_API_KEY', 'G_API_KEY', 'X_API_KEY'], function (data) {
    if (data.C_API_KEY && data.C_API_KEY !== 'null') {
      document.getElementById('c-api-key').value = data.C_API_KEY;
      updateApiKeyStatus('C_API_KEY', document.getElementById('c-key-status'), document.getElementById('c-api-key'));
    } else {
      updateApiKeyStatus('C_API_KEY', document.getElementById('c-key-status'), document.getElementById('c-api-key'));
    }

    if (data.G_API_KEY && data.G_API_KEY !== 'null') {
      document.getElementById('g-api-key').value = data.G_API_KEY;
      updateApiKeyStatus('G_API_KEY', document.getElementById('g-key-status'), document.getElementById('g-api-key'));
    } else {
      updateApiKeyStatus('G_API_KEY', document.getElementById('g-key-status'), document.getElementById('g-api-key'));
    }

    if (data.X_API_KEY && data.X_API_KEY !== 'null') {
      document.getElementById('x-api-key').value = data.X_API_KEY;
      updateApiKeyStatus('X_API_KEY', document.getElementById('x-key-status'), document.getElementById('x-api-key'));
    } else {
      updateApiKeyStatus('X_API_KEY', document.getElementById('x-key-status'), document.getElementById('x-api-key'));
    }
  });

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs[0] && tabs[0].url && tabs[0].url.includes('kalvium.community')) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: function () {
          return {
            C_API_KEY: localStorage.getItem('C_API_KEY') || '',
            G_API_KEY: localStorage.getItem('G_API_KEY') || '',
            X_API_KEY: localStorage.getItem('X_API_KEY') || ''
          };
        }
      }, function (results) {
        if (results && results[0] && results[0].result) {
          const keys = results[0].result;
          if (keys.C_API_KEY) {
            document.getElementById('c-api-key').value = keys.C_API_KEY;
            updateApiKeyStatus('C_API_KEY', document.getElementById('c-key-status'), document.getElementById('c-api-key'));
            chrome.storage.local.set({ C_API_KEY: keys.C_API_KEY });
          }
          if (keys.G_API_KEY) {
            document.getElementById('g-api-key').value = keys.G_API_KEY;
            updateApiKeyStatus('G_API_KEY', document.getElementById('g-key-status'), document.getElementById('g-api-key'));
            chrome.storage.local.set({ G_API_KEY: keys.G_API_KEY });
          }
          if (keys.X_API_KEY) {
            document.getElementById('x-api-key').value = keys.X_API_KEY;
            updateApiKeyStatus('X_API_KEY', document.getElementById('x-key-status'), document.getElementById('x-api-key'));
            chrome.storage.local.set({ X_API_KEY: keys.X_API_KEY });
          }
        }
      });
    }
  });
}

function saveApiKey(keyName, inputElement, statusElement) {
  const value = inputElement.value.trim();
  const storageData = {};
  storageData[keyName] = value;

  chrome.storage.local.set(storageData, function () {
    updateApiKeyStatus(keyName, statusElement, inputElement);

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0] && tabs[0].url && tabs[0].url.includes('kalvium.community')) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: function (key, val) {
            if (val) {
              localStorage.setItem(key, val);
            } else {
              localStorage.removeItem(key);
            }
          },
          args: [keyName, value]
        });
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  const autoStartElement = document.getElementById('auto-start');
  const aiModelElement = document.getElementById('ai-model');
  const bypassFullscreenElement = document.getElementById('bypass-fullscreen');

  chrome.storage.sync.get('autoStart', function (data) {
    autoStart = data.autoStart || '0';
    autoStartElement.value = autoStart;
  });
  autoStartElement.addEventListener('change', function () {
    autoStart = autoStartElement.value;
    chrome.storage.sync.set({ autoStart: autoStart });
  });

  chrome.storage.sync.get('aiModel', function (data) {
    let aiModel = data.aiModel || 'gemini-2.5-flash';
    aiModelElement.value = aiModel;
  });
  aiModelElement.addEventListener('change', function () {
    let aiModel = aiModelElement.value;
    chrome.storage.sync.set({ aiModel: aiModel });
  });

  chrome.storage.sync.get('bypassFullscreen', function (data) {
    let bypassFullscreen = data.bypassFullscreen || '1';
    bypassFullscreenElement.value = bypassFullscreen;
  });
  bypassFullscreenElement.addEventListener('change', function () {
    let bypassFullscreen = bypassFullscreenElement.value;
    chrome.storage.sync.set({ bypassFullscreen: bypassFullscreen });
  });

  loadApiKeysFromStorage();

  document.querySelectorAll('.toggle-visibility').forEach(btn => {
    btn.addEventListener('click', function () {
      const targetId = this.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (input.type === 'password') {
        input.type = 'text';
        this.textContent = 'Hide';
      } else {
        input.type = 'password';
        this.textContent = 'Show';
      }
    });
  });

  document.querySelectorAll('.save-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const keyName = this.getAttribute('data-key');
      const inputId = this.getAttribute('data-input');
      const input = document.getElementById(inputId);
      let statusId;
      if (keyName === 'C_API_KEY') {
        statusId = 'c-key-status';
      } else if (keyName === 'G_API_KEY') {
        statusId = 'g-key-status';
      } else if (keyName === 'X_API_KEY') {
        statusId = 'x-key-status';
      }
      const status = document.getElementById(statusId);
      saveApiKey(keyName, input, status);
      this.textContent = 'Saved!';
      setTimeout(() => {
        this.textContent = 'Save';
      }, 1000);
    });
  });

  document.getElementById('c-api-key').addEventListener('input', function () {
    updateApiKeyStatus('C_API_KEY', document.getElementById('c-key-status'), this);
  });

  document.getElementById('g-api-key').addEventListener('input', function () {
    updateApiKeyStatus('G_API_KEY', document.getElementById('g-key-status'), this);
  });

  document.getElementById('x-api-key').addEventListener('input', function () {
    updateApiKeyStatus('X_API_KEY', document.getElementById('x-key-status'), this);
  });
});
