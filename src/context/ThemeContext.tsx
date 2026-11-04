import React, { createContext, useContext, useState, useEffect } from 'react';
import { TossThemeMode, ThemeConfig, THEME_CONFIGS } from '../utils/theme';

interface ThemeContextType {
  themeMode: TossThemeMode;
  setThemeMode: (mode: TossThemeMode) => void;
  theme: ThemeConfig;
  isPreviewModalOpen: boolean;
  setIsPreviewModalOpen: (open: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'tech',
  setThemeMode: () => {},
  theme: THEME_CONFIGS.tech,
  isPreviewModalOpen: false,
  setIsPreviewModalOpen: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<TossThemeMode>(() => {
    const saved = localStorage.getItem('toss_theme_mode') as TossThemeMode;
    return saved && THEME_CONFIGS[saved] ? saved : 'tech';
  });
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);

  const setThemeMode = (mode: TossThemeMode) => {
    setThemeModeState(mode);
    localStorage.setItem('toss_theme_mode', mode);
  };

  const theme = THEME_CONFIGS[themeMode] || THEME_CONFIGS.tech;

  return (
    <ThemeContext.Provider
      value={{
        themeMode,
        setThemeMode,
        theme,
        isPreviewModalOpen,
        setIsPreviewModalOpen,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
