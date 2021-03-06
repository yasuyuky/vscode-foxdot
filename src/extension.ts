import * as vscode from "vscode";
import {
  TextEditor,
  Selection,
  StatusBarItem,
  StatusBarAlignment,
  OutputChannel,
} from "vscode";
import { spawn, ChildProcess } from "child_process";
import { existsSync } from "fs";
import * as path from "path";
import * as util from "util";

enum FeedbackStyle {
  outputChannel,
  infomationMessage,
}

let foxDotProc: ChildProcess;
let foxDotStatus: StatusBarItem;
let foxDotBeat: StatusBarItem;
let foxDotOutput: OutputChannel;
let feedbackStyle: FeedbackStyle;
let outputHooks: Map<string, (s: string) => any> = new Map();

export function activate(context: vscode.ExtensionContext) {
  let commands = new Map<string, (...args: any[]) => any>([
    ["foxdot.start", start],
    ["foxdot.send", send],
    ["foxdot.sendSelections", sendSelections],
    ["foxdot.stop", stop],
    ["foxdot.record", record],
    ["foxdot.stopRecording", stopRecording],
    ["foxdot.openRecDir", openRecDir],
  ]);

  for (const [key, func] of commands)
    context.subscriptions.push(
      vscode.commands.registerTextEditorCommand(key, func)
    );
}

function startProcess(command: string) {
  foxDotProc = spawn(command, ["-m", "FoxDot", "-p"]);
  foxDotProc.stdout?.on("data", handleOutputData);
  foxDotProc.stderr?.on("data", handleErrorData);
  foxDotProc.on("close", handleOnClose);
}

function setupStatus() {
  foxDotStatus = vscode.window.createStatusBarItem(StatusBarAlignment.Left, 10);
  foxDotStatus.text = "FoxDot >>";
  foxDotStatus.command = "foxdot.record";
  foxDotStatus.show();
  foxDotBeat = vscode.window.createStatusBarItem(StatusBarAlignment.Right, 10);
  foxDotBeat.text = "";
  foxDotBeat.show();
  showBeat();
}

function setupOutput() {
  foxDotOutput = vscode.window.createOutputChannel("FoxDot");
  foxDotOutput.show(true);
}

function setOutputHook(key: string, handler: (_: string) => any) {
  outputHooks?.set(key, (s) => {
    handler(s.slice(key.length));
    outputHooks.delete(key);
  });
}

function openRecDir() {
  setOutputHook("recdir: ", handleRecDir);
  foxDotProc.stdin?.write("print('recdir: '+Settings.RECORDING_DIR)\n\n");
}

function handleRecDir(p: string) {
  let recUri = vscode.Uri.file(p.trim());
  vscode.env.openExternal(recUri);
}

const sleep = (msec: number) => util.promisify(setTimeout)(msec);

async function showBeat() {
  while (!foxDotProc.killed) {
    setOutputHook("beat:", handleBeat);
    foxDotProc.stdin?.write(
      "print('beat:', int(Clock.now() % Clock.bars()))\n\n"
    );
    await sleep(100);
  }
}

function handleBeat(b: string) {
  let n = parseInt(b);
  foxDotBeat.text = "_".repeat(n) + ">" + "_".repeat(3 - n);
}

function selectPython(config: vscode.WorkspaceConfiguration): string {
  let rootPath = vscode.workspace.rootPath || "";
  let venvPath = path.join(rootPath, config.get<string>("venvPath") || "");
  let venvPython = path.join(venvPath, "bin", "python");
  let directPath = config.get<string>("pythonPath") || "";
  if (venvPath && existsSync(venvPython)) return venvPython;
  else if (directPath) return directPath;
  return "python";
}

function start(editor: TextEditor) {
  if (foxDotProc && !foxDotProc.killed) return;
  let config = vscode.workspace.getConfiguration("foxdot");
  vscode.languages.setTextDocumentLanguage(editor.document, "python");
  feedbackStyle = config.get("feedbackStyle") || FeedbackStyle.outputChannel;
  let pythonPath = selectPython(config);
  vscode.window.showInformationMessage("Using: " + pythonPath);
  startProcess(pythonPath);
  setupStatus();
  setupOutput();
  vscode.window.showInformationMessage("FoxDot has started!");
}

function printFeedback(s: string) {
  switch (feedbackStyle) {
    case FeedbackStyle.infomationMessage:
      vscode.window.showInformationMessage(s);
      break;
    default:
      foxDotOutput.appendLine(s);
  }
}

function handleOutputData(data: any) {
  const s: string = data.toString();
  for (const [k, f] of outputHooks) if (s.startsWith(k)) return f(s);
  printFeedback(s);
}

function handleErrorData(data: any) {
  vscode.window.showErrorMessage(data.toString());
}

function handleOnClose(code: number) {
  if (code) vscode.window.showErrorMessage(`FoxDot has exited: ${code}.`);
  else vscode.window.showInformationMessage(`FoxDot has stopped.`);
  foxDotStatus?.dispose();
  foxDotBeat?.dispose();
}

function stop() {
  foxDotProc.kill();
}

function record() {
  foxDotProc.stdin?.write("Server.record()\n\n");
  foxDotStatus.command = "foxdot.stopRecording";
  vscode.window.showInformationMessage("Start Recording");
}

function stopRecording() {
  foxDotProc.stdin?.write("Server.stopRecording()\n\n");
  foxDotStatus.command = "foxdot.record";
  vscode.window.showInformationMessage("Stop Recording");
}

function selectCursorsContexts(editor: TextEditor) {
  editor.selections = editor.selections.map((s) => {
    let [d, sl, el] = [editor.document, s.start.line, s.end.line];
    let r = d.lineAt(sl).range.union(d.lineAt(el).range);
    for (let l = sl; l >= 0 && !d.lineAt(l).isEmptyOrWhitespace; l--)
      r = r.union(d.lineAt(l).range);
    for (let l = el; l < d.lineCount && !d.lineAt(l).isEmptyOrWhitespace; l++)
      r = r.union(d.lineAt(l).range);
    return new Selection(r.start, r.end);
  });
}

function send(editor: TextEditor) {
  selectCursorsContexts(editor);
  sendSelections(editor);
}

function sendSelections(editor: TextEditor) {
  for (const s of editor.selections) {
    let t = editor.document.getText(s);
    printFeedback(">>> " + t);
    foxDotProc.stdin?.write(t + "\n\n");
  }
  editor.selections = editor.selections.map(
    (s) => new Selection(s.active, s.active)
  );
}

export function deactivate() {
  stop();
}
