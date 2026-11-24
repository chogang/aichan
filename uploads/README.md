# Catalog uploads · 곡 목록 업로드

Upload the full game song catalog as `uploads/songlist.json`. Include `uploads/packlist.json` in the same change if you also have updated pack names or pack relationships.

정식 게임의 전체 곡 목록을 이 폴더에 `songlist.json` 이름으로 올립니다. 팩 이름이나 상위 팩 구성이 바뀌었다면 `packlist.json`도 같은 변경에 포함합니다.

- A pull request validates the files. Merging to `main` generates the public catalog and deploys the viewer. 자세한 동작과 API 배포 설정은 [사용 설명서](../README.ko.md#곡-데이터-갱신)를 참고하세요.
- Use the full game songlist, including each song's `difficulties` array. 저장소 루트의 `songlist.json`은 생성된 경량 곡 목록입니다.
