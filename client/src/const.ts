export const startLogin = (redirectPath = "/acesso") => {
  if (typeof window === "undefined") return;
  if (window.location.pathname !== redirectPath) {
    window.location.assign(redirectPath);
  }
};
