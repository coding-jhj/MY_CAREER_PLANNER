import { expect, test, type Page } from "@playwright/test";

type DashboardResponse = { currentPlan: { id: string; title: string } | null };
type TaskResponse = { id: string; title: string };
type ExportResponse = { plans: Array<{ id: string; title: string }>; tasks: Array<{ id: string; title: string; status: string }>; executionRecords: Array<{ id: string; taskId: string }> };

async function addTask(page: Page, title: string, tag: string): Promise<void> {
  const form = page.getByRole("form", { name: "새 할 일 양식" });
  await form.getByLabel("할 일 제목").fill(title);
  await form.getByLabel("태그").fill(tag);
  await form.getByLabel("우선순위").fill("1");
  await form.getByLabel("예상 시간(분)").fill("15");
  await form.getByRole("button", { name: "할 일 추가" }).click();
  await expect(page.getByRole("button", { name: `${title} 완료 기록 열기` })).toBeVisible();
}

test("T06 public Plan–Do–See data persists safely", async ({ page }) => {
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => { dialogs.push(dialog.message()); await dialog.dismiss(); });

  await page.goto("/");
  await expect(page.getByText(/로그인 기능이 없습니다/)).toBeVisible();
  const initialDashboard = await page.request.get("/api/dashboard");
  expect(initialDashboard.ok()).toBeTruthy();
  const initial = await initialDashboard.json() as DashboardResponse;
  expect(initial.currentPlan).not.toBeNull();
  const originalPlanId = initial.currentPlan!.id;

  await page.getByRole("button", { name: "현재 계획 수정 양식 열기" }).click();
  const planForm = page.getByRole("form", { name: "계획 수정 양식" });
  const revisedTitle = `T06 계획 수정 ${Date.now()}`;
  await planForm.getByLabel("계획 제목").fill(revisedTitle);
  await planForm.getByRole("button", { name: "계획 저장" }).click();
  await expect(page.getByText(revisedTitle, { exact: true })).toBeVisible();
  await expect(page.getByText(/이전 값 #\d+:/)).toBeVisible();

  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const taskTitles = Array.from({ length: 5 }, (_, index) => `T06 작업 ${index + 1} ${suffix}`);
  for (const [index, title] of taskTitles.entries()) await addTask(page, title, index % 2 === 0 ? "t06-search" : "t06-filter");
  const scriptTitle = "<script>alert(1)</script>";
  await addTask(page, scriptTitle, "t06-safety");
  await expect(page.getByText(scriptTitle, { exact: true })).toBeVisible();
  expect(dialogs).toEqual([]);

  const toolbar = page.getByLabel("할 일 검색 및 필터");
  await toolbar.getByLabel("할 일 검색").fill(taskTitles[0]);
  await expect(page.getByText(taskTitles[0], { exact: true })).toBeVisible();
  await expect(page.getByText(taskTitles[1], { exact: true })).toHaveCount(0);
  await toolbar.getByLabel("할 일 검색").fill("");
  await toolbar.getByLabel("태그").fill("t06-filter");
  await expect(page.getByText(taskTitles[1], { exact: true })).toBeVisible();
  await expect(page.getByText(taskTitles[0], { exact: true })).toHaveCount(0);
  await toolbar.getByLabel("태그").fill("");
  await toolbar.getByLabel("정렬").selectOption("estimated_minutes");
  await toolbar.getByLabel("정렬 방향").selectOption("desc");
  await expect(page.getByText("현재 정렬: estimated_minutes · desc")).toBeVisible();

  const completedTitle = taskTitles[0];
  await page.getByRole("button", { name: `${completedTitle} 완료 기록 열기` }).click();
  const completionForm = page.getByRole("form", { name: `${completedTitle} 완료 시간 기록` });
  await completionForm.getByLabel("시작 시각").fill("2026-09-07T09:00");
  await completionForm.getByLabel("종료 시각").fill("2026-09-07T09:30");
  const firstCompletion = page.waitForResponse((response) => response.url().includes("/complete") && response.request().method() === "POST");
  await completionForm.getByRole("button", { name: "완료 저장" }).click();
  const firstResponse = await firstCompletion;
  expect(firstResponse.ok()).toBeTruthy();
  const firstRecord = await firstResponse.json() as { id: string };
  const repeatedResponse = await page.request.post(new URL(firstResponse.url()).pathname, { data: firstResponse.request().postDataJSON() });
  expect(repeatedResponse.ok()).toBeTruthy();
  expect((await repeatedResponse.json() as { id: string }).id).toBe(firstRecord.id);

  const afterCompletion = await page.request.get("/api/export");
  const afterCompletionExport = await afterCompletion.json() as ExportResponse;
  const completedTask = afterCompletionExport.tasks.find((task) => task.title === completedTitle);
  expect(completedTask).toBeDefined();
  expect(afterCompletionExport.executionRecords.filter((record) => record.taskId === completedTask!.id)).toHaveLength(1);
  await expect(page.getByRole("button", { name: `${completedTitle} 진행 중으로 되돌리기` })).toBeVisible();
  await page.getByRole("button", { name: `${completedTitle} 진행 중으로 되돌리기` }).click();
  await expect(page.getByRole("button", { name: "완료 0개 필터 적용" })).toBeVisible();

  await page.getByRole("button", { name: /^계획 .* 원본 할 일 보기$/ }).click();
  await expect(page.getByText("돌아보기 지표 원본만 표시")).toBeVisible();
  await expect(page.getByText(completedTitle, { exact: true })).toBeVisible();

  const correctionForm = page.getByRole("form", { name: "개선점 다음 계획 반영" });
  const nextTitle = `T06 다음 계획 ${suffix}`;
  await correctionForm.getByLabel("개선점").fill("실제 기록을 바탕으로 다음 계획의 시간을 조정한다.");
  await correctionForm.getByLabel("다음 계획 제목").fill(nextTitle);
  await correctionForm.getByLabel("다음 계획 시작일").fill("2026-10-08");
  await correctionForm.getByLabel("다음 계획 종료일").fill("2026-10-14");
  await correctionForm.getByLabel("예상 시간(분)").fill("60");
  await correctionForm.getByLabel("다음 계획 성공 기준").fill("실제 결과를 기록한다.");
  await correctionForm.getByRole("button", { name: "다음 계획으로 넘기기" }).click();
  await expect(page.getByText(/개선점을 다음 계획에 반영했습니다/)).toBeVisible();

  await page.reload();
  await expect(page.getByText(nextTitle, { exact: true })).toBeVisible();
  const persistedExportResponse = await page.request.get("/api/export");
  const persistedExport = await persistedExportResponse.json() as ExportResponse;
  expect(persistedExport.plans.some((plan) => plan.id === originalPlanId && plan.title === revisedTitle)).toBeTruthy();
  expect(persistedExport.tasks.some((task) => task.id === completedTask!.id && task.status === "in_progress")).toBeTruthy();
  expect(persistedExport.executionRecords.filter((record) => record.taskId === completedTask!.id)).toHaveLength(1);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON 내보내기" }).click();
  expect((await download).suggestedFilename()).toBe("pds-export-v2.json");
  expect(dialogs).toEqual([]);
});
