{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:
{
  cachix.enable = false;
  dotenv.disableHint = true;

  packages = with pkgs; [ git ];
  languages = {
    javascript = {
      enable = true;
      bun.enable = true;

      package = pkgs.nodejs_24;
    };
  };
}
