import { createAuthClient } from "better-auth/react";
import { adminClient, magicLinkClient, inferAdditionalFields, twoFactorClient, organizationClient } from "better-auth/client/plugins";
import type { Auth } from "../../api/src/infra/lib/auth";

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    magicLinkClient(),
    twoFactorClient(),
    organizationClient(),
    inferAdditionalFields<Auth>(),
  ],
});

export const {
  useSession,
  signIn,
  signUp,
  signOut,
  requestPasswordReset,
  resetPassword,
} = authClient;
