import { Component, type ErrorInfo, type ReactNode } from 'react';
import { SCHEMA_VERSION } from '@/domain';
import { I18nContextConsumer } from '@/i18n/useT';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  copied: boolean;
}

/** Diagnostics contain no design data (plan §9.5). */
function diagnostics(error: Error): string {
  return [
    `App version: ${__APP_VERSION__}`,
    `Schema version: ${SCHEMA_VERSION}`,
    `User agent: ${navigator.userAgent}`,
    `Error: ${error.message}`,
    error.stack ?? '',
  ].join('\n');
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, copied: false };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render() {
    const { error, copied } = this.state;
    if (!error) return this.props.children;
    return (
      <I18nContextConsumer>
        {({ t }) => (
          <div className="error-boundary" role="alert">
            <p>{t('error.title')}</p>
            <pre className="error-message">{error.message}</pre>
            <div className="button-row">
              <button
                type="button"
                onClick={() => {
                  window.location.reload();
                }}
              >
                {t('common.reload')}
              </button>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(diagnostics(error)).then(() => {
                    this.setState({ copied: true });
                  });
                }}
              >
                {t('error.copyDiagnostics')}
              </button>
            </div>
            {copied && <p role="status">{t('error.copied')}</p>}
          </div>
        )}
      </I18nContextConsumer>
    );
  }
}
