/// <reference types="react/canary" />

/*
 * `<ViewTransition>`은 React canary 타입에만 있다 (`@types/react/canary.d.ts`).
 * Next 16의 App Router는 canary React를 쓰므로 런타임에는 존재하지만,
 * 이 참조가 없으면 타입 검사에서만 "react에 그런 export가 없다"고 나온다
 * (`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`).
 */
