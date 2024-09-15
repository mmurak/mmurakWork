// module
import WaveSurfer from 'https://cdn.jsdelivr.net/npm/wavesurfer.js@7/dist/wavesurfer.esm.js';
import { FieldEnabler } from "./FieldEnabler.js";

class TimeMarkerManager {
	constructor(clickCallback) {
		this.dataPool = [];
		this.clickCallback = clickCallback;
	}
	addData(sectionStart, sectionEnd, note) {
		this.dataPool.push([sectionStart, sectionEnd, note]);
	}
	deleteData(node) {
		let idx = Number(node.id.replace("r", "")) - 1;
		this.dataPool.splice(idx, 1);
	}
	buildTable(tableObj) {
		tableObj.innerHTML = "";
		let tNo = 1;
		for (let elem of this.dataPool) {
			let newRow = tableObj.insertRow(-1);
			newRow.id = "r" + tNo;

			// Play button cell
			let playCell = newRow.insertCell(0);
			let playCellA = document.createElement("input");
			playCellA.type = "button";
			playCellA.value = "PLAY";
			playCellA.addEventListener("click", () => { this.clickCallback("ps", newRow); });
			playCell.appendChild(playCellA);

			// Start cell
			let cellZero = newRow.insertCell(1);
			let startTime = document.createTextNode(convertTimeRep(elem[0]));
			cellZero.appendChild(startTime);

			// Stop cell
			let cellOne = newRow.insertCell(2);
			let endTime = document.createTextNode(convertTimeRep(elem[1]));
			cellOne.appendChild(endTime);

			// Waste bin 🗑️
			let cellWaste = newRow.insertCell(3);
			let cellWasteAnchor = document.createElement("a");
			cellWasteAnchor.addEventListener("click", () => { this.clickCallback("del", newRow); });
			cellWasteAnchor.innerHTML = "🗑️";
			cellWaste.appendChild(cellWasteAnchor);

			tNo++;
		}
	}
	buttonDisabler(tableObj, flag) {
		for (let row of tableObj.rows) {
			row.cells[0].children[0].disabled = flag;
		}
	}
}

class GlobalManager {
	constructor() {
		this.inputFile = document.getElementById("InputFile");
		this.timerField = document.getElementById("TimerField");
		this.zoomIn = document.getElementById("ZoomIn");
		this.zoomOut = document.getElementById("ZoomOut");
		this.playPause = document.getElementById("PlayPause");
		this.speedHeader = document.getElementById("SpeedHeader");
		this.speedDigits = document.getElementById("SpeedDigits");
		this.speedVal = document.getElementById("SpeedVal");
		this.jumpSelector = document.getElementById("JumpSelector");
		this.leftArrowButton = document.getElementById("LeftArrowButton");
		this.rightArrowButton = document.getElementById("RightArrowButton");
		this.loopFlag = document.getElementById("LoopFlag");
		this.markA = document.getElementById("MarkA");
		this.markB = document.getElementById("MarkB");
		this.abTable = document.getElementById("ABtable");

		this.wavePlayer = null;

		this.currentZoomFactor = 10;
		this.minimumZoomFactor = 10;
		this.zoomDelta = 10;
		this.timer;
		this.timerObj = null;

		this.sectionStart = 0;
		this.sectionEnd = 0;
		this.playStartMark = 0;
		this.playEndMark = -1;

		this.timeMarkerManager = new TimeMarkerManager(abControl);

		this.fieldEnabler = new FieldEnabler([
			"InputFile",
			"PlayPause",
			"SpeedHeader",
			"SpeedVal",
			"RightArrowButton",
			"LeftArrowButton",
			"MarkA",
			"MarkB",
		]);

		this.fieldEnabler.setEnable(["InputFile"]);

	}
}
const G = new GlobalManager();

/*
 * waveSurfer section
 */

// File input
G.inputFile.addEventListener("change", (e) => {
	let file = G.inputFile.files[0];
	if (file) {
		if (G.wavePlayer != null) {
			G.wavePlayer.destroy();
		}
		G.wavePlayer = WaveSurfer.create({
			container: '#waveform',
			waveColor: '#00BFFF',
			progressColor: '#87CEBB',
			height: 250,
		});
		G.wavePlayer.on("ready", () => {
			readyCB();
		});
		G.wavePlayer.on("play", () => {
			playCB();
		});
		G.wavePlayer.on("pause", () => {
			pauseCB();
		});
		G.wavePlayer.on("timeupdate", (time) => {
			if (G.playEndMark != -1) {
				if (time >= G.playEndMark) {
					G.wavePlayer.pause();
					if (G.loopFlag.checked) {
						G.wavePlayer.setTime(G.playStartMark);
						G.wavePlayer.play();
					} else {
						G.playEndMark = -1;
					}
				}
			}
			updateProgressFromSec(time);
		});
		const url = URL.createObjectURL(file);
		G.wavePlayer.load(url);
		G.fieldEnabler.setEnable([
			"InputFile",
		]);
	}
});

G.inputFile.addEventListener("focus", () => {G.inputFile.blur()});	// this is to prevent activation by key-input.

// Play/Pause control
G.playPause.addEventListener("click", playPauseControl);

// Reset play speed
G.speedHeader.addEventListener("click", () => {
	G.speedVal.value = 1.0;
	G.speedVal.dispatchEvent(new Event("input"));
});

// Change play speed
G.speedVal.addEventListener("input", _changePlaySpeed);
function _changePlaySpeed() {
	G.speedDigits.innerHTML = Number(G.speedVal.value).toFixed(2);
	G.wavePlayer.setPlaybackRate(G.speedVal.value, true);
}

G.jumpSelector.addEventListener("change", (evt) => {
	evt.preventDefault();
});

G.leftArrowButton.addEventListener("click", leftButtonClick);
G.rightArrowButton.addEventListener("click", rightButtonClick);

G.zoomIn.addEventListener("click", () => {
	G.zoomOut.disabled = false;
	G.currentZoomFactor += G.zoomDelta;
	G.wavePlayer.zoom(G.currentZoomFactor);
});

G.zoomOut.addEventListener("click", () => {
	if (G.currentZoomFactor > G.minimumZoomFactor) {
		G.currentZoomFactor -= G.zoomDelta;
		G.wavePlayer.zoom(G.currentZoomFactor);
		if (G.currentZoomFactor == G.minimumZoomFactor) {
			G.zoomOut.disabled = true;
		}
	}
});

G.markA.addEventListener("click", markSectionStart);

G.markB.addEventListener("click", markSectionEnd);

document.addEventListener("keydown", (evt) => {
	if (G.playPause.disabled)  return;
	if (evt.key == " ") {
		playPauseControl();
		evt.preventDefault();
	} else if (evt.key == "ArrowLeft") {
		leftButtonClick();
	} else if (evt.key == "ArrowRight") {
		rightButtonClick();
	} else if ((evt.key >= "1") && (evt.key <= 9)) {
		let delta = (evt.ctrlKey) ? Number(evt.key) : -Number(evt.key);
		G.wavePlayer.setTime(G.wavePlayer.getCurrentTime() + delta);
	} else if (evt.key == "ArrowUp") {
		G.speedVal.value = Number(G.speedVal.value) + 0.05;
		_changePlaySpeed();
	} else if (evt.key == "ArrowDown") {
		G.speedVal.value = Number(G.speedVal.value) - 0.05;
		_changePlaySpeed();
	} else if ((evt.key == "a") || (evt.key == "A")) {
		markSectionStart();
	} else if ((evt.key == "b") || (evt.key == "B")) {
		markSectionEnd();
	}
});



// Callback functions (for fieldEnabler)
function readyCB() {
	G.fieldEnabler.setEnable([
		"InputFile",
		"PlayPause",
		"SpeedHeader",
		"SpeedVal",
		"LeftArrowButton",
		"RightArrowButton",
		"MarkA",
		"MarkB",
	]);
	G.zoomIn.disabled = false;
	G.speedVal.value = 1.0;
	G.speedDigits.innerHTML = Number(G.speedVal.value).toFixed(2);
}
function playCB() {
	G.fieldEnabler.setEnable([
		"PlayPause",
		"SpeedHeader",
		"SpeedVal",
		"LeftArrowButton",
		"RightArrowButton",
		"MarkA",
		"MarkB",
	]);
	G.playPause.value = "Pause";
	G.timeMarkerManager.buttonDisabler(G.abTable, true);
}
function pauseCB() {
	G.fieldEnabler.setEnable([
		"InputFile",
		"PlayPause",
		"SpeedHeader",
		"SpeedVal",
		"LeftArrowButton",
		"RightArrowButton",
		"MarkA",
		"MarkB",
	]);
	G.playPause.value = "Play";
	G.timeMarkerManager.buttonDisabler(G.abTable, false);
}

function playPauseControl() {
	G.playStartMark = 0;
	G.playEndMark = -1;
	if (G.wavePlayer.isPlaying()) {
		G.wavePlayer.pause();
	} else {
		G.wavePlayer.play();
	}
}

function leftButtonClick() {
	G.wavePlayer.setTime(G.wavePlayer.getCurrentTime() - Number(G.jumpSelector.value));
}

function rightButtonClick() {
	G.wavePlayer.setTime(G.wavePlayer.getCurrentTime() + Number(G.jumpSelector.value));
}

function markSectionStart() {
	G.sectionStart = G.wavePlayer.getCurrentTime();
}

function markSectionEnd() {
	const currentTime = G.wavePlayer.getCurrentTime();
	if (currentTime <= G.sectionStart)  return;
	G.sectionEnd = currentTime;
	G.timeMarkerManager.addData(G.sectionStart, G.sectionEnd, "some notes");
	G.timeMarkerManager.buildTable(G.abTable);
	if (G.wavePlayer.isPlaying()) {
		G.timeMarkerManager.buttonDisabler(G.abTable, true);
	}
}

function convertTimeRep(time) {
	let formattedTime = [
		Math.floor(time / 3600),
		Math.floor((time % 3600) / 60), // minutes
		Math.floor(time % 60), // seconds
	].map((v) => (v < 10 ? '0' + v : v)).join(':');
	formattedTime += "." + ("" + Math.trunc(time * 100) % 100).padStart(2, "0");
	return formattedTime;
}

function updateProgressFromSec(time) {
	G.timerField.innerHTML = convertTimeRep(time);
}

function timeRepToSec(str) {
	const seg = str.split(":");
	return Number(Number(seg[0]) * 3600 + Number(seg[1]) * 60 + seg[2]);
}

function abControl(command, node) {
	if (G.wavePlayer.isPlaying())  return;
	if (command == "del") {
		G.timeMarkerManager.deleteData(node);
		G.timeMarkerManager.buildTable(G.abTable);
		
	} else {
		G.playStartMark = Number(timeRepToSec(node.cells[1].innerHTML));
		G.wavePlayer.setTime(G.playStartMark);
		G.playEndMark =  Number(timeRepToSec(node.cells[2].innerHTML));
		G.wavePlayer.play();
	}
}