const {
  incrementBuild,
  incrementPatch,
  incrementMinor,
  incrementMajor,
} = require("./version-manager");

const command = process.argv[2];

switch (command) {
  case "increment-build":
    console.log("Incrementing build number...");
    console.log("New version:", incrementBuild());
    break;
  case "increment-patch":
    console.log("Incrementing patch version...");
    console.log("New version:", incrementPatch());
    break;
  case "increment-minor":
    console.log("Incrementing minor version...");
    console.log("New version:", incrementMinor());
    break;
  case "increment-major":
    console.log("Incrementing major version...");
    console.log("New version:", incrementMajor());
    break;
  default:
    console.error("Invalid command. Use one of:");
    console.error("  increment-build");
    console.error("  increment-patch");
    console.error("  increment-minor");
    console.error("  increment-major");
    process.exit(1);
}
