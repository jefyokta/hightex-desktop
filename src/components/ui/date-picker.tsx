import * as React from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldLabel } from "@/components/ui/field";
// import "@"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
interface Props {
  date?: Date;
  setDate: (date?: Date) => any;
  label: string;
}
export function DatePickerInput({ date, setDate, label }: Props) {
  const [open, setOpen] = React.useState(false);
  const id = label.toLowerCase().replace(" ", "-");

  return (
    <Field>
      <FieldLabel className="text-xs text-muted-foreground" htmlFor={id}>
        {label}
      </FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger>
          <Button
            variant="outline"
            id={id}
            className="justify-start font-normal w-full"
          >
            {date ? date.toLocaleDateString("id-ID") : "Select date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            captionLayout="dropdown"
            onSelect={(date) => {
              setDate(date);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </Field>
  );
}
