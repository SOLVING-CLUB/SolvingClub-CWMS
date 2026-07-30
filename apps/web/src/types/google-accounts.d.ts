declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initCodeClient(config: {
            client_id: string;
            scope: string;
            ux_mode: "popup" | "redirect";
            redirect_uri?: string;
            callback: (response: { code?: string; error?: string; error_description?: string }) => void;
            access_type?: "offline";
            prompt?: string;
            include_granted_scopes?: boolean;
          }): {
            requestCode(): void;
          };
        };
      };
    };
  }
}

export {};
