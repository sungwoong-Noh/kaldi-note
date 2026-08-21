import { redirect } from 'next/navigation';

/** 지금은 보여줄 홈이 따로 없다. 목록이 사실상의 첫 화면이다. */
export default function Home() {
  redirect('/recipes');
}
