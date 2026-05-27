import { format } from "date-fns";
import { id } from "date-fns/locale";

export const formatDate = (date?: Date) => {
  date = date ?? new Date();

  return format(date, "dd MMMM yyyy", { locale: id });
};
