export type InputType = 'csv' | 'json' | 'tsv' | 'list';

export interface ProcessOptions {
    inputType: InputType;
    listSeparator?: string;
    template: string;
    isBulk: boolean;
    bulkPrefix?: string;
    bulkSuffix?: string;
    bulkJoinInline?: boolean;
}

export function processData(input: string, options: ProcessOptions): string {
    if (!input) return '';

    const data = parseInput(input, options.inputType, options.listSeparator);

    if (!options.isBulk) {
        return data.map(row => applyTemplate(options.template, row)).join('\n');
    } else {
        const separator = options.bulkJoinInline ? ', ' : ',\n';
        const generated = data.map(row => applyTemplate(options.template, row)).join(separator);

        if (options.bulkJoinInline) {
            return `${options.bulkPrefix || ''}${generated}${options.bulkSuffix || ''}`;
        } else {
            return `${options.bulkPrefix || ''}\n${generated}\n${options.bulkSuffix || ''}`;
        }
    }
}

function parseInput(input: string, type: InputType, listSeparator: string = ','): any[] {
    if (type === 'json') {
        try {
            const parsed = JSON.parse(input);
            return Array.isArray(parsed) ? parsed : [parsed];
        } catch (_e) {
            throw new Error('Invalid JSON');
        }
    }

    let separator = ',';
    if (type === 'tsv') {
        separator = '\t';
    }
    if (type === 'list') {
        return input.split(listSeparator).map(item => ({ value: item.trim() })).filter(item => item.value);
    }

    const lines = input.trim().split('\n');
    if (lines.length < 1) {
        return [];
    }

    const headers = lines[0].split(separator).map((h: string) => h.trim());
    if (lines.length === 1) {
        return [];
    }

    return lines.slice(1).map((line: string) => {
        const values = line.split(separator).map((v: string) => v.trim());
        const obj: any = {};
        headers.forEach((h: string, i: number) => {
            obj[h] = values[i] || '';
        });
        return obj;
    });
}

function applyTemplate(template: string, row: any): string {
    return template.replace(/{{(\w+)}}/g, (_, key) => {
        return row[key] !== undefined ? row[key] : `{{${key}}}`;
    });
}
