import React, { Component, type ReactNode } from "react";
interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(_error: Error): State {
    return { hasError: true, error: null };
  }
  render() {
    if (this.state.hasError)
      return (
        <main className="page-wrap narrow-page" role="alert">
          <h1>Não foi possível exibir esta tela.</h1>
          <p>
            Nenhum detalhe privado do erro é mostrado. Recarregue para tentar
            novamente.
          </p>
          <button
            className="button button--primary"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
        </main>
      );
    return this.props.children;
  }
}
