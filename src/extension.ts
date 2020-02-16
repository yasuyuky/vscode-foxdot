import * as vscode from "vscode";
import {
  TextEditor,
  Selection,
  StatusBarItem,
  StatusBarAlignment,
  OutputChannel
} from "vscode";
import { spawn, ChildProcess } from "child_process";

enum FeedbackStyle {
  outputChannel,
  infomationMessage
}

let foxDotProc: ChildProcess;
let foxDotStatus: StatusBarItem;
let foxDotOutput: OutputChannel;
let feedbackStyle: FeedbackStyle;
let outputHooks: Map<string, (s: string) => any>;

export function activate(context: vscode.ExtensionContext) {
  let commands = new Map<string, (...args: any[]) => any>([
    ["foxdot.start", start],
    ["foxdot.sendSelections", sendSelections],
    ["foxdot.stop", stop],
    ["foxdot.restart", restart],
    ["foxdot.record", record],
    ["foxdot.stopRecording", stopRecording]
  ]);

  for (const [key, func] of commands)
    context.subscriptions.push(
      vscode.commands.registerTextEditorCommand(key, func)
    );
}

function startProcess(command: string) {
  foxDotProc = spawn(command, ["-m", "FoxDot", "-p"]);
  foxDotProc.stdout.on("data", handleOutputData);
  foxDotProc.stderr.on("data", handleErrorData);
  foxDotProc.on("close", handleOnClose);
}

function setupStatus() {
  foxDotStatus = vscode.window.createStatusBarItem(StatusBarAlignment.Left, 10);
  foxDotStatus.text = "FoxDot >>";
  foxDotStatus.command = "foxdot.record";
  foxDotStatus.show();
}

function setupOutput() {
  outputHooks = new Map();
  foxDotOutput = vscode.window.createOutputChannel("FoxDot");
  foxDotOutput.show();
}

function start() {
  let config = vscode.workspace.getConfiguration("foxdot");
  feedbackStyle = config.get("feedbackStyle") || FeedbackStyle.outputChannel;
  startProcess(config.get("pythonPath") || "python");
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
}

function stop() {
  foxDotProc.kill();
}

function restart() {
  stop();
  start();
}

function record() {
  foxDotProc.stdin.write("Server.record()\n\n");
  foxDotStatus.command = "foxdot.stopRecording";
  vscode.window.showInformationMessage("Start Recording");
}

function stopRecording() {
  foxDotProc.stdin.write("Server.stopRecording()\n\n");
  foxDotStatus.command = "foxdot.record";
  vscode.window.showInformationMessage("Stop Recording");
}

function sendSelections(editor: TextEditor) {
  for (const s of editor.selections) {
    let t = editor.document.getText(s);
    printFeedback(">>> " + t);
    foxDotProc.stdin.write(t + "\n\n");
  }
  editor.selections = editor.selections.map(
    s => new Selection(s.active, s.active)
  );
}

export function deactivate() {
  stop();
}
