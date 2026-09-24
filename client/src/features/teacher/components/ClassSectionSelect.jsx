import { FormField } from '../../../components/ui/FormField.jsx';
import { Select } from '../../../components/ui/Select.jsx';
import { classSectionValue } from '../classSection.js';

/** The teacher's own class-sections (from GET /teacher-assignments/mine). */
export function ClassSectionSelect({
  classSections = [],
  value,
  onChange,
  label = 'Class',
  placeholder,
  className,
}) {
  return (
    <FormField label={label} className={className}>
      <Select
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(event) => {
          const [classId, sectionId] = event.target.value.split(':');
          onChange(event.target.value ? { classId, sectionId } : null);
        }}
        options={classSections.map((cs) => ({ value: classSectionValue(cs), label: cs.label }))}
      />
    </FormField>
  );
}
