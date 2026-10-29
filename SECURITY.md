# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- **Network**: outgoing HTTPS requests to the public Téléray map of the ASNR
  (`teleray.asnr.fr`) only. It opens no port and needs no account, token or
  key.
- **`/data`**: `teleray.json`, the public list of the Téléray stations (names,
  numbers, positions) and the last 24 hours of measurements of the followed
  stations. No secret.
- **Gladys**: the integration reads the location of the houses to pick the
  closest station. The coordinates never leave the container (the distance is
  computed locally) and are neither stored nor logged.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the Téléray service.
