module.exports = {
  apps: [
    {
      name: "atmb-server",
      cwd: __dirname,
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "3000"
      }
    },
    {
      name: "atmb-web",
      cwd: `${__dirname}\\web`,
      script: "npm",
      args: "run start",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
