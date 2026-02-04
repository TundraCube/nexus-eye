chrome.action.onClicked.addListener((tab) => {
  chrome.storage.local.get(["enabled"], (result) => {
    const newState = result.enabled === false ? true : false;
    chrome.storage.local.set({ enabled: newState }, () => {
      console.log(`[Nexus-Eye] Toggled to: ${newState}`);
      // Notify the active tab to reload or re-apply
      chrome.tabs.sendMessage(tab.id, { action: "toggle", enabled: newState });
      
      // Update icon badge/visuals if needed
      chrome.action.setBadgeText({ text: newState ? "" : "OFF" });
      chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    });
  });
});

// Initialize badge state
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ enabled: true });
});
