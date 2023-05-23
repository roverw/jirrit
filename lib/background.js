/* Click on Extension Icon */

chrome.action.onClicked.addListener(async () => {
	const gerritHost = await getGerritHost();
	const gerritUser = await getGerritUser();
	const gerritPass = await getGerritPass();

	chrome.tabs.query({active: true, currentWindow: true}, tabs => {
		chrome.tabs.sendMessage(tabs[0].id, {
			type: 'toggleNativePopup',
			configured: !!gerritHost,
			host: gerritHost,
			user: gerritUser,
			pass: gerritPass
		});
	});
});


/* Active Tab Change */

let previousActiveTabId = '';

chrome.tabs.onActivated.addListener(active => {
	if (previousActiveTabId){ notifyTabOfActiveTabChange(previousActiveTabId); }
	notifyTabOfActiveTabChange(active.tabId);
	previousActiveTabId = active.tabId;
});

function notifyTabOfActiveTabChange(tabId){
	chrome.tabs.sendMessage(tabId, {
		type: 'activeTabChange'
	});
}


/* Gerrit Response */

function setLastGerritResponse(status, tabId){
	chrome.tabs.sendMessage(tabId, {
		type: 'setLastGerritResponse',
		status
	});
}


/* Messages */

chrome.runtime.onMessage.addListener(handleMessage);

function handleMessage(message, sender, sendResponse){
	console.log("!!!!! background msg");
	switch (message.type) {
		case 'tryGetChangesByJiraKey':
			tryGetChangesByJiraKey(message.jiraKey, sender.tab.id, sendResponse);
			break;
		case 'setListBadge':
			setListBadge(message.value, sender.tab.id);
			break;
		case 'setGerritHost':
			setGerritHost(message.host, message.user, message.pass, sender.tab.id, sendResponse);
			break;
	}
	return true;
}

function purgeLocalChanges(tabId){
	chrome.tabs.sendMessage(tabId, {
		type: 'purgeLocalChanges'
	});
}


/* Gerrit */

async function tryGetChangesByJiraKey(jiraKey, tabId, sendResponse){
	const gerritHost = await getGerritHost();
	if (gerritHost) {
		try{
			const result = await getChangesByJiraKey(jiraKey);
			console.log("!!!!! got "+result.data);
			sendResponse(result.data);
			setLastGerritResponse(result.status, tabId);
		}catch(err){
			sendResponse([]);
			setLastGerritResponse(0, tabId);
		}
	}else{
		setConfigNeededBadge(tabId);
		purgeLocalChanges(tabId);
	}
}

async function getChangesByJiraKey(jiraKey){
	const gerritHost = await getGerritHost();
	const gerritUser = await getGerritUser();
	const gerritPass = await getGerritPass();

	const headers = new Headers();
	headers.set('Authorization', 'Basic ' + btoa(gerritUser + ":" + gerritPass));

	console.log("!!!!!! getChangesByJiraKey "+jiraKey);

	const response = await fetch(`${gerritHost}/changes/?q=message:${jiraKey}`, 
		{method:'GET',
		headers: headers,		
		}
		);
		
	console.log("!!!!!! getChangesByJiraKey status "+response.status);
	if (response.status !== 200){
		return {
			status: response.status,
			data: []
		}
	}

	const responseText = await response.text();

	console.log("!!!!!! getChangesByJiraKey resp "+responseText);

	const trimmedText = responseText.substring(4);
	const json = JSON.parse(trimmedText);
	return {
		status: response.status,
		data: json
	};
}


/* Badge */

function setConfigNeededBadge(tabId){
	setBadge('?', tabId);
	setBadgeColor('rgb(254, 80, 0)', tabId);
}

function setListBadge(value, tabId){
	setBadge(value, tabId);
	setBadgeColor('rgb(0, 82, 204)', tabId);
}

function setBadge(value, tabId){
	chrome.action.setBadgeText({
		tabId,
		text: value ? value.toString() : ''
	});
}

function setBadgeColor(color, tabId){
	chrome.action.setBadgeBackgroundColor({
		tabId,
		color
	});
}


/* Local Storage */

async function setGerritHost(host, user, pass, tabId, sendResponse){
	await chrome.storage.local.set({ gerritHost: host, gerritUser: user, gerritPass: pass });
	sendResponse();
	setListBadge('', tabId);
}

async function getGerritHost(){
	const data = await chrome.storage.local.get(['gerritHost']);
	return data['gerritHost'];
}

async function getGerritUser(){
	const data = await chrome.storage.local.get(['gerritUser']);
	return data['gerritUser'];
}

async function getGerritPass(){
	const data = await chrome.storage.local.get(['gerritPass']);
	return data['gerritPass'];
}
