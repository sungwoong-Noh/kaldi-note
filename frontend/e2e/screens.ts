export interface Screen {
  readonly path: string;
  /** 탭바가 보이는 화면인가. 숨는 규칙은 BottomNav의 HIDDEN_PREFIXES가 정한다. */
  readonly hasTabBar: boolean;
}

export const SCREENS: readonly Screen[] = [
  { path: "/", hasTabBar: true },
  { path: "/recipes", hasTabBar: true },
  { path: "/recipes/12", hasTabBar: true },
  { path: "/brews", hasTabBar: true },
  { path: "/brews/2", hasTabBar: true },
  { path: "/more", hasTabBar: true },
  { path: "/gear/grind-converter", hasTabBar: true },
  { path: "/recipes/new", hasTabBar: false },
  { path: "/brews/new?recipeId=12", hasTabBar: false },
  { path: "/recipes/12/edit", hasTabBar: false },
  { path: "/brews/2/edit", hasTabBar: false },
];

export const TAB_BAR_SCREENS = SCREENS.filter((s) => s.hasTabBar);
