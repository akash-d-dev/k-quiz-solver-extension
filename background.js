console.log("Background script initialized");

let currentTabUrl = "";

const logToken = (data) => {
  try {
    for (let header of data.requestHeaders) {
      if (header.name.toLowerCase() === "authorization") {
        chrome.storage.sync.set({
          token: header,
          currentTabUrl: currentTabUrl,
        }).catch(err => console.error("Storage error:", err));
        return;
      }
    }
  } catch (error) {
    console.error("Error in logToken:", error);
  }
};

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  try {
    if (changeInfo.status === "complete" && tab.url) {
      currentTabUrl = tab.url;
    }
  } catch (error) {
    console.error("Error in tab update listener:", error);
  }
});

chrome.webRequest.onSendHeaders.addListener(
  (data) => {
    logToken(data);
  },
  {
    urls: [
      "https://signal-api.kalvium.community/*",
      "https://assessment-api.kalvium.community/api/assessments/*",
    ],
  },
  ["requestHeaders"]
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "bypassFullscreen") {
    (async () => {
      try {
        console.log("Bypass fullscreen request received");
        
        const currentTab = sender.tab;

        if (!currentTab || !currentTab.id) {
          console.error("No tab found in sender");
          sendResponse({ success: false, error: "No tab found" });
          return;
        }

        console.log("Current tab:", currentTab.id);

        const allTabs = await chrome.tabs.query({ currentWindow: true });
        let targetTab = allTabs.find((tab) => tab.id !== currentTab.id);

        if (!targetTab) {
          console.log("Creating new tab");
          targetTab = await chrome.tabs.create({
            url: "about:blank",
            active: true,
          });
        } else {
          console.log("Switching to existing tab:", targetTab.id);
          await chrome.tabs.update(targetTab.id, { active: true });
        }

        await new Promise((resolve) => setTimeout(resolve, 1500));

        console.log("Switching back to quiz tab");
        await chrome.tabs.update(currentTab.id, { active: true });

        sendResponse({ success: true });
      } catch (error) {
        console.error("Bypass fullscreen error:", error);
        sendResponse({ success: false, error: error.message });
      }
    })();

    return true;
  }
  
  console.log("Unknown action received:", request.action);
  return false;
});
