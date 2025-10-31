/**
 * 現在のストレージタイプを取得する
 * @param {Function} callback - ストレージオブジェクトを受け取るコールバック
 */
function getStorage(callback) {
  chrome.storage.local.get(["useSync"], (result) => {
    const storage =
      result.useSync !== false ? chrome.storage.sync : chrome.storage.local;
    callback(storage);
  });
}

/**
 * 拡張機能のインストール時にリダイレクトルールを初期化する
 */
chrome.runtime.onInstalled.addListener(() => {
  getStorage((storage) => {
    storage.get(["redirectRules"], (result) => {
      if (!result.redirectRules) {
        /** 空の配列で初期化 */
        storage.set({ redirectRules: [] });
      }
    });
  });
});

/**
 * URLが指定されたパターンにマッチするかチェックする
 * @param {string} url - チェック対象のURL
 * @param {string} pattern - マッチパターン（ワイルドカード*使用可能）
 * @returns {boolean} マッチする場合true
 */
function matchesPattern(url, pattern) {
  try {
    /** ワイルドカード(*)を正規表現に変換 */
    let regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // 特殊文字をエスケープ
      .replace(/\*/g, ".*"); // *を.*に変換

    /** パターンの前後に^と$を追加して完全一致にする */
    /** ただし、パターンが/*で終わる場合はそのまま */
    if (!regexPattern.endsWith(".*")) {
      regexPattern = "^" + regexPattern + "/?$";
    } else {
      regexPattern = "^" + regexPattern + "$";
    }

    const regex = new RegExp(regexPattern, "i");
    const result = regex.test(url);

    console.log(`Pattern match: "${pattern}" vs "${url}" = ${result}`);
    return result;
  } catch (e) {
    console.error("Invalid pattern:", pattern, e);
    return false;
  }
}

/**
 * ページ読み込み時のリダイレクト処理
 * 有効なルールにマッチした場合、指定されたURLへリダイレクトする
 */
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  /** メインフレームのみ処理 */
  if (details.frameId !== 0) return;

  getStorage((storage) => {
    storage.get(["redirectRules"], (result) => {
      const rules = result.redirectRules || [];

      for (const rule of rules) {
        if (rule.enabled && matchesPattern(details.url, rule.pattern)) {
          /** リダイレクト先が現在のURLと同じ場合は無限ループを防ぐ */
          if (details.url === rule.redirect) {
            console.log(
              `Skipped redirect: ${details.url} (same as redirect target)`
            );
            continue;
          }

          /** リダイレクト実行 */
          chrome.tabs.update(details.tabId, { url: rule.redirect });
          console.log(`Redirected: ${details.url} -> ${rule.redirect}`);
          break; // 最初にマッチしたルールのみ適用
        }
      }
    });
  });
});
