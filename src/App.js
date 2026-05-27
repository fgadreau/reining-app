import React from "react";
import "./App.css";
import AppRouter from "./app/router/AppRouter";
import { I18nProvider } from "./features/i18n/I18nProvider";

function App() {
  return (
    <I18nProvider>
      <AppRouter />
    </I18nProvider>
  );
}

export default App;
