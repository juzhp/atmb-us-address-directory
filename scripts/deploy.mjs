import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const webDir = path.join(rootDir, "web");
const dataDir = path.join(rootDir, "data");
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const pm2Command = isWindows ? "pm2.cmd" : "pm2";

const args = new Set(process.argv.slice(2));
const options = {
  install: !args.has("--skip-install"),
  build: !args.has("--skip-build"),
  pm2: args.has("--pm2"),
  dryRun: args.has("--dry-run")
};

async function main() {
  log("开始部署准备。");

  ensureDirectory(dataDir);
  checkEnvFile();

  if (options.install) {
    await runCommand(npmCommand, ["install"], rootDir);
    await runCommand(npmCommand, ["install"], webDir);
  } else {
    log("已跳过依赖安装。");
  }

  if (options.build) {
    await runCommand(npmCommand, ["run", "build:web"], rootDir);
  } else {
    log("已跳过前端构建。");
  }

  if (options.pm2) {
    await ensurePm2Available();
    await deployWithPm2();
  } else {
    log("未启用 PM2 发布，如需启动服务请追加 --pm2。");
  }

  log("部署脚本执行完成。");
}

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function checkEnvFile() {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) {
    log("未检测到根目录 .env，部署前请确认已按 .env.example 配置环境变量。");
  }
}

async function ensurePm2Available() {
  try {
    await runCommand(pm2Command, ["-v"], rootDir, { silent: true });
  } catch {
    throw new Error("未检测到 PM2，请先执行 `npm install -g pm2`。");
  }
}

async function deployWithPm2() {
  const ecosystemFile = path.join(rootDir, "ecosystem.config.cjs");

  try {
    await runCommand(pm2Command, ["describe", "atmb-server"], rootDir, { silent: true });
    log("检测到现有 PM2 进程，开始重载。");
    await runCommand(pm2Command, ["reload", ecosystemFile, "--update-env"], rootDir);
  } catch {
    log("未检测到现有 PM2 进程，开始首次启动。");
    await runCommand(pm2Command, ["start", ecosystemFile], rootDir);
  }

  await runCommand(pm2Command, ["save"], rootDir);
}

function runCommand(command, commandArgs, cwd, extra = {}) {
  const label = `${command} ${commandArgs.join(" ")}`.trim();
  if (options.dryRun) {
    log(`[dry-run] ${label}`);
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd,
      stdio: extra.silent ? ["ignore", "ignore", "ignore"] : "inherit",
      shell: false,
      env: process.env
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`命令执行失败: ${label} (exit ${code ?? "unknown"})`));
    });
  });
}

function log(message) {
  console.log(`[deploy] ${message}`);
}

main().catch((error) => {
  console.error(`[deploy] ${error.message}`);
  process.exit(1);
});
