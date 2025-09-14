export class Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.pageCount = Math.ceil(total / limit);
  }
}
